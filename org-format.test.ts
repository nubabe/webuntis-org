import { describe, expect, it } from "vitest";
import { buildOrgFileContent, consoleLine, joinOrgBlocks, orgEntry, orgTimestamp } from "./org-format";
import { entryKey } from "./org-key";
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

/** A registry assigning each item a predictable test id, keyed the same way the real registry is. */
const idsFor = (...items: ReadonlyArray<TaggedLessonItem>): OrgIdRegistry =>
  Object.fromEntries(items.map((it, i) => [entryKey(it), `test-id-${i}`]));

describe("orgTimestamp", () => {
  it("formats an org-mode inactive-style timestamp with weekday and time range", () => {
    // 2026-03-02 is a Monday
    expect(orgTimestamp(item())).toBe("<2026-03-02 Mon 08:00-08:50>");
  });
});

describe("orgEntry", () => {
  it("renders keyword/subject/tags, an ID + UNTIS_KEY property drawer, timestamp, room, teachers, and notes", () => {
    const built = item({
      keyword: "EXAM",
      subject: "Math",
      teachers: ["Smith", "Jones"],
      notes: ["Bring calculator"],
      tags: ["math"],
    });
    const entry = orgEntry(built, idsFor(built));
    expect(entry).toBe(
      [
        "* EXAM Math :math:",
        ":PROPERTIES:",
        ":ID: test-id-0",
        `:UNTIS_KEY: ${entryKey(built)}`,
        ":END:",
        "<2026-03-02 Mon 08:00-08:50>",
        "R101",
        "Smith, Jones",
        "Bring calculator",
      ].join("\n"),
    );
  });

  it("renders multiple tags colon-joined", () => {
    const built = item({ tags: ["math", "exam"] });
    expect(orgEntry(built, idsFor(built))).toContain("* CLASS Math :math:exam:");
  });

  it("omits the tag suffix entirely when there are no tags", () => {
    const built = item({ tags: [] });
    expect(orgEntry(built, idsFor(built))).toContain("* CLASS Math\n");
  });

  it("omits a notes line entirely when there are no notes", () => {
    const built = item({ notes: [] });
    const entry = orgEntry(built, idsFor(built));
    expect(entry.endsWith("Smith")).toBe(true);
  });

  it("throws when no org-id is assigned for the entry's key", () => {
    expect(() => orgEntry(item(), {})).toThrow(/No org-id assigned/);
  });
});

describe("consoleLine", () => {
  it("formats a one-line summary with date, time, subject, room, teachers", () => {
    expect(consoleLine(item())).toBe("  2026-03-02 08:00-08:50  Math, R101, Smith");
  });

  it("appends notes with an em-dash separator when present", () => {
    expect(consoleLine(item({ notes: ["Note A", "Note B"] }))).toBe(
      "  2026-03-02 08:00-08:50  Math, R101, Smith — Note A Note B",
    );
  });
});

describe("joinOrgBlocks", () => {
  it("returns an empty string for no blocks", () => {
    expect(joinOrgBlocks([])).toBe("");
  });

  it("joins blocks with a blank line and ends with a trailing newline", () => {
    expect(joinOrgBlocks(["a", "b"])).toBe("a\n\nb\n");
  });
});

describe("buildOrgFileContent", () => {
  it("returns an empty string for no items", () => {
    expect(buildOrgFileContent([], {})).toBe("");
  });

  it("joins entries with a blank line and ends with a trailing newline", () => {
    const a = item({ subject: "Math" });
    const b = item({ subject: "Physics", keyword: "EXAM" });
    const ids = idsFor(a, b);
    expect(buildOrgFileContent([a, b], ids)).toBe(`${orgEntry(a, ids)}\n\n${orgEntry(b, ids)}\n`);
  });
});
