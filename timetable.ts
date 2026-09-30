import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { Effect } from "effect";
import {
  TimetableClient,
  clientConfigFromEnv,
  makeWebUntisLayer,
  type WebUntisError,
} from "@schnau/webuntis-api";
import type { ConfigurationError } from "@schnau/webuntis-api";
import { buildLessonItems, loadEntries, partitionActive, resolveDateRange } from "./pipeline";
import { consoleLine, joinOrgBlocks, orgEntry } from "./org-format";
import { entryKey } from "./org-key";
import { pastEntriesText } from "./org-merge";
import { generateOrgIds } from "./org-id-gen";
import { ensureOrgIds, loadOrgIds, saveOrgIds } from "./org-id-registry";
import { applyAutomaticRules, loadRules } from "./rules";
import { applyOverrides, captureManualEdits, loadOverrides, saveOverrides } from "./overrides";
import { loadSnapshot, saveSnapshot } from "./snapshot";
import { toIsoDate } from "./date";

const ORG_FILE_PATH = "data/timetable.org";

const mode: "day" | "year" = process.argv[2] === "year" ? "year" : "day";

const run = Effect.gen(function* () {
  const previousOrgText = existsSync(ORG_FILE_PATH) ? readFileSync(ORG_FILE_PATH, "utf8") : null;

  if (previousOrgText !== null) {
    const updated = captureManualEdits(previousOrgText, loadSnapshot(), loadOverrides());
    saveOverrides(updated);
  }

  const timetable = yield* TimetableClient;

  const menu = yield* timetable.getMenu;
  if (menu.myTimetable === null) {
    return yield* Effect.fail(
      new Error("WebUntis account has no personal timetable (myTimetable is null)."),
    );
  }
  const { type: resourceType, resource } = menu.myTimetable;

  const range = yield* resolveDateRange(mode);
  const { entries, chunkCount } = yield* loadEntries(timetable, resourceType, resource.id, range);
  const { active, cancelledCount } = partitionActive(entries);
  const { items: mergedItems, mergedCount } = buildLessonItems(active);
  const tagged = applyAutomaticRules(mergedItems, loadRules());
  const excludedCount = mergedItems.length - tagged.length;
  const items = applyOverrides(tagged, loadOverrides());
  const manuallyDeletedCount = tagged.length - items.length;

  console.log(
    `Timetable for ${resource.displayName} (${range.start} – ${range.end}): ${entries.length} lesson(s) across ${chunkCount} request(s).`,
  );
  if (cancelledCount > 0) {
    console.log(`Skipped ${cancelledCount} cancelled lesson(s) (no teacher assigned).`);
  }
  if (mergedCount > 0) {
    console.log(`Merged ${mergedCount} split exam period(s) into a single entry.`);
  }
  if (excludedCount > 0) {
    console.log(`Excluded ${excludedCount} lesson(s) matching a rule.`);
  }
  if (manuallyDeletedCount > 0) {
    console.log(`Applied ${manuallyDeletedCount} manual deletion(s).`);
  }
  if (mode === "day") {
    for (const item of items) {
      console.log(consoleLine(item));
    }
  }

  const { registry: orgIds, addedCount: newOrgIdCount } = ensureOrgIds(
    items.map(entryKey),
    loadOrgIds(),
    generateOrgIds,
  );
  saveOrgIds(orgIds);
  if (newOrgIdCount > 0) {
    console.log(`Assigned ${newOrgIdCount} new org-id(s).`);
  }

  // Past dates are never refetched (see resolveDateRange), so their last-written text —
  // including any manual edits — is preserved verbatim instead of being regenerated.
  const pastBlocks = previousOrgText !== null ? pastEntriesText(previousOrgText, toIsoDate(new Date())) : [];
  writeFileSync(
    ORG_FILE_PATH,
    joinOrgBlocks([...pastBlocks, ...items.map((item) => orgEntry(item, orgIds))]),
  );
  saveSnapshot(items, orgIds);
  console.log(
    `Wrote ${pastBlocks.length + items.length} entries to ${ORG_FILE_PATH} (${pastBlocks.length} preserved past, ${items.length} regenerated).`,
  );
});

const program: Effect.Effect<void, ConfigurationError | WebUntisError | Error> = Effect.gen(
  function* () {
    const config = yield* clientConfigFromEnv();
    const layer = makeWebUntisLayer(config);
    yield* run.pipe(Effect.provide(layer));
  },
);

// Guard so importing this module (e.g. from tests) doesn't trigger a live run.
const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  await Effect.runPromise(
    program.pipe(
      Effect.catch((error) => {
        const tagged = "_tag" in error ? `${error._tag}: ` : "";
        console.error(`WebUntis error - ${tagged}${error.message}`);
        return Effect.sync(() => {
          process.exitCode = 1;
        });
      }),
    ),
  );
}
