import { describe, expect, it } from "vitest";
import { orgEntry } from "./org-format";
import { entryKey } from "./org-key";
import { pastEntriesText } from "./org-merge";
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

describe("pastEntriesText", () => {
  it("returns text for entries strictly before today", () => {
    const past = item({ start: "2026-03-01T08:00:00", end: "2026-03-01T08:50:00" });
    const future = item({ start: "2026-03-05T08:00:00", end: "2026-03-05T08:50:00" });
    const ids = idsFor(past, future);
    const text = `${orgEntry(past, ids)}\n\n${orgEntry(future, ids)}`;
    expect(pastEntriesText(text, "2026-03-02")).toEqual([orgEntry(past, ids)]);
  });

  it("does not treat today's own entries as past", () => {
    const today = item({ start: "2026-03-02T08:00:00", end: "2026-03-02T08:50:00" });
    expect(pastEntriesText(orgEntry(today, idsFor(today)), "2026-03-02")).toEqual([]);
  });

  it("returns an empty array for empty input", () => {
    expect(pastEntriesText("", "2026-03-02")).toEqual([]);
  });

  it("preserves manual edits appended to a past entry's text verbatim", () => {
    const past = item({ start: "2026-03-01T08:00:00", end: "2026-03-01T08:50:00" });
    const edited = `${orgEntry(past, idsFor(past))}\nHandwritten note`;
    expect(pastEntriesText(edited, "2026-03-02")).toEqual([edited]);
  });
});
