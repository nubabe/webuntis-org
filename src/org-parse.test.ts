import { describe, expect, it } from "vitest";
import { buildOrgFileContent, orgEntry } from "./org-format";
import { entryKey } from "./org-key";
import { parseOrgEntries } from "./org-parse";
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

describe("parseOrgEntries", () => {
  it("round-trips orgEntry output back to the same key and text", () => {
    const a = item({ subject: "Math" });
    const text = orgEntry(a, idsFor(a));
    expect(parseOrgEntries(text)).toEqual([{ key: entryKey(a), text }]);
  });

  it("parses multiple entries from a full generated file", () => {
    const a = item({ subject: "Math" });
    const b = item({ subject: "Physics", keyword: "EXAM" });
    const parsed = parseOrgEntries(buildOrgFileContent([a, b], idsFor(a, b)));
    expect(parsed.map((p) => p.key)).toEqual([entryKey(a), entryKey(b)]);
  });

  it("preserves a human-appended note line as part of the entry's text", () => {
    const a = item({ subject: "Math" });
    const edited = `${orgEntry(a, idsFor(a))}\nRemember to bring textbook`;
    const [parsed] = parseOrgEntries(edited);
    expect(parsed.text).toBe(edited);
  });

  it("skips a block with no UNTIS_KEY property (content not ours to track)", () => {
    expect(parseOrgEntries("* Some unrelated heading\nplain notes")).toEqual([]);
  });

  it("drops an entry entirely missing from the text (simulating a human deletion)", () => {
    const a = item({ subject: "Math" });
    const b = item({ subject: "Physics" });
    const full = buildOrgFileContent([a, b], idsFor(a, b));
    const withADeleted = full.split("\n\n").slice(1).join("\n\n");
    expect(parseOrgEntries(withADeleted).map((p) => p.key)).toEqual([entryKey(b)]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseOrgEntries("")).toEqual([]);
  });
});
