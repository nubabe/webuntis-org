import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { orgEntry } from "./org-format";
import { entryKey } from "./org-key";
import type { OrgIdRegistry } from "./org-id-registry";
import type { Snapshot } from "./overrides";
import type { TaggedLessonItem } from "./rules";

const SNAPSHOT_FILE_PATH = ".timetable-snapshot.json";

export const loadSnapshot = (): Snapshot =>
  existsSync(SNAPSHOT_FILE_PATH) ? JSON.parse(readFileSync(SNAPSHOT_FILE_PATH, "utf8")) : {};

/** Records the exact org text just written for each item, so the next run's capture step can diff against it. */
export const saveSnapshot = (items: ReadonlyArray<TaggedLessonItem>, orgIds: OrgIdRegistry): void => {
  const snapshot: Record<string, string> = {};
  for (const item of items) {
    snapshot[entryKey(item)] = orgEntry(item, orgIds);
  }
  writeFileSync(SNAPSHOT_FILE_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
};
