import "dotenv/config";
import { writeFileSync } from "node:fs";
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
import { buildOrgFileContent, consoleLine } from "./org-format";

const ORG_FILE_PATH = "timetable.org";

const mode: "day" | "year" = process.argv[2] === "year" ? "year" : "day";

const run = Effect.gen(function* () {
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
  const { items, mergedCount } = buildLessonItems(active);

  console.log(
    `Timetable for ${resource.displayName} (${range.start} – ${range.end}): ${entries.length} lesson(s) across ${chunkCount} request(s).`,
  );
  if (cancelledCount > 0) {
    console.log(`Skipped ${cancelledCount} cancelled lesson(s) (no teacher assigned).`);
  }
  if (mergedCount > 0) {
    console.log(`Merged ${mergedCount} split exam period(s) into a single entry.`);
  }
  if (mode === "day") {
    for (const item of items) {
      console.log(consoleLine(item));
    }
  }

  writeFileSync(ORG_FILE_PATH, buildOrgFileContent(items));
  console.log(`Wrote ${items.length} entries to ${ORG_FILE_PATH}`);
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
