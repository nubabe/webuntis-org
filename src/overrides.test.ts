import { describe, expect, it } from "vitest";
import { orgEntry } from "./org-format";
import { entryKey } from "./org-key";
import { applyOverrides, captureManualEdits, type Overrides, type Snapshot } from "./overrides";
import type { OrgIdRegistry } from "./org-id-registry";
import type { TaggedLessonItem } from "./rules";

const item = (overrides: Partial<TaggedLessonItem> = {}): TaggedLessonItem => ({
  keyword: "CLASS",
  start: "2026-03-02T08:00:00",
  end: "2026-03-02T08:50:00",
  subject: "Math",
  teachers: ["Smith"],
  room: "R101",
  notes: [],
  tags: ["math"],
  ...overrides,
});

const idsFor = (...items: ReadonlyArray<TaggedLessonItem>): OrgIdRegistry =>
  Object.fromEntries(items.map((it, i) => [entryKey(it), `test-id-${i}`]));

describe("applyOverrides", () => {
  it("drops items whose key is marked deleted", () => {
    const a = item({ subject: "Math" });
    const overrides: Overrides = { [entryKey(a)]: { delete: true } };
    expect(applyOverrides([a], overrides)).toEqual([]);
  });

  it("appends extraNotes to a matching item's notes", () => {
    const a = item({ subject: "Math", notes: ["original"] });
    const overrides: Overrides = { [entryKey(a)]: { extraNotes: ["human note"] } };
    expect(applyOverrides([a], overrides)[0].notes).toEqual(["original", "human note"]);
  });

  it("leaves items with no matching override untouched", () => {
    const a = item({ subject: "Math" });
    expect(applyOverrides([a], {})).toEqual([a]);
  });
});

describe("captureManualEdits", () => {
  it("records a delete override when a snapshot-tracked entry is missing from the current text", () => {
    const a = item({ subject: "Math" });
    const snapshot: Snapshot = { [entryKey(a)]: orgEntry(a, idsFor(a)) };
    const result = captureManualEdits("", snapshot, {});
    expect(result[entryKey(a)]).toEqual({ delete: true });
  });

  it("records extraNotes when a human appended a line after the generated entry", () => {
    const a = item({ subject: "Math" });
    const baseline = orgEntry(a, idsFor(a));
    const snapshot: Snapshot = { [entryKey(a)]: baseline };
    const edited = `${baseline}\nDon't forget the textbook`;
    const result = captureManualEdits(edited, snapshot, {});
    expect(result[entryKey(a)]).toEqual({ extraNotes: ["Don't forget the textbook"] });
  });

  it("does not change anything when the current text still matches the snapshot exactly", () => {
    const a = item({ subject: "Math" });
    const baseline = orgEntry(a, idsFor(a));
    const snapshot: Snapshot = { [entryKey(a)]: baseline };
    expect(captureManualEdits(baseline, snapshot, {})).toEqual({});
  });

  it("leaves unrelated existing overrides untouched", () => {
    const a = item({ subject: "Math" });
    const baseline = orgEntry(a, idsFor(a));
    const snapshot: Snapshot = { [entryKey(a)]: baseline };
    const existing: Overrides = { "some-other-key": { delete: true } };
    const result = captureManualEdits(baseline, snapshot, existing);
    expect(result).toEqual(existing);
  });

  it("only diffs entries present in the snapshot, ignoring untracked content", () => {
    const result = captureManualEdits("* Unrelated heading\nsome text", {}, {});
    expect(result).toEqual({});
  });
});
