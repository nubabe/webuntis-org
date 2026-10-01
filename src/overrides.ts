import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseOrgEntries } from "./org-parse";
import type { TaggedLessonItem } from "./rules";
import { entryKey } from "./org-key";

const OVERRIDES_FILE_PATH = "data/overrides.json";

export interface Override {
  readonly delete?: true;
  readonly extraNotes?: ReadonlyArray<string>;
}

export interface Overrides {
  readonly [key: string]: Override;
}

/** Key -> the full org text last mechanically written for that entry (see snapshot.ts). */
export interface Snapshot {
  readonly [key: string]: string;
}

export const loadOverrides = (): Overrides =>
  existsSync(OVERRIDES_FILE_PATH) ? JSON.parse(readFileSync(OVERRIDES_FILE_PATH, "utf8")) : {};

export const saveOverrides = (overrides: Overrides): void =>
  writeFileSync(OVERRIDES_FILE_PATH, `${JSON.stringify(overrides, null, 2)}\n`);

/** Drops entries marked deleted, appends any captured freeform notes to the rest. */
export const applyOverrides = (
  items: ReadonlyArray<TaggedLessonItem>,
  overrides: Overrides,
): ReadonlyArray<TaggedLessonItem> =>
  items
    .filter((item) => !overrides[entryKey(item)]?.delete)
    .map((item) => {
      const extraNotes = overrides[entryKey(item)]?.extraNotes;
      return extraNotes && extraNotes.length > 0
        ? { ...item, notes: [...item.notes, ...extraNotes] }
        : item;
    });

export interface CaptureManualEditsResult {
  readonly overrides: Overrides;
  /** Keys whose text changed from the baseline in a way that isn't a pure append (e.g. an
   * in-place edit to an existing line) — not captured, since only appended lines are supported. */
  readonly unrecognizedKeys: ReadonlyArray<string>;
}

/**
 * Diffs the current (possibly human-edited) org file against the snapshot of what was last
 * mechanically written, and folds any human deletions or appended note lines into `overrides`.
 * Only entries present in `snapshot` are considered — those are the ones the machine wrote and
 * therefore knows the "clean" baseline for; anything else in the file isn't ours to diff.
 */
export const captureManualEdits = (
  currentOrgText: string,
  snapshot: Snapshot,
  overrides: Overrides,
): CaptureManualEditsResult => {
  const current = new Map(parseOrgEntries(currentOrgText).map((e) => [e.key, e.text]));
  const updates: Record<string, Override> = {};
  const unrecognizedKeys: string[] = [];

  for (const [key, baselineText] of Object.entries(snapshot)) {
    const currentText = current.get(key);

    if (currentText === undefined) {
      updates[key] = { delete: true };
      continue;
    }

    if (currentText === baselineText) continue;

    if (!currentText.startsWith(baselineText)) {
      unrecognizedKeys.push(key);
      continue;
    }

    const extra = currentText
      .slice(baselineText.length)
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (extra.length > 0) {
      updates[key] = { extraNotes: extra };
    }
  }

  return { overrides: { ...overrides, ...updates }, unrecognizedKeys };
};
