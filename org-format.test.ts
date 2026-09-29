import { describe, expect, it } from "vitest";
import { buildOrgFileContent, consoleLine, orgEntry, orgTimestamp } from "./org-format";
import type { LessonItem } from "./webuntis-mapping";

const item = (overrides: Partial<LessonItem> = {}): LessonItem => ({
  keyword: "CLASS",
  start: "2026-03-02T08:00:00",
  end: "2026-03-02T08:50:00",
  subject: "Math",
  teachers: ["Smith"],
  room: "R101",
  notes: [],
  ...overrides,
});

describe("orgTimestamp", () => {
  it("formats an org-mode inactive-style timestamp with weekday and time range", () => {
    // 2026-03-02 is a Monday
    expect(orgTimestamp(item())).toBe("<2026-03-02 Mon 08:00-08:50>");
  });
});

describe("orgEntry", () => {
  it("renders keyword/subject, timestamp, room, teachers, and notes as org lines", () => {
    const entry = orgEntry(
      item({ keyword: "EXAM", subject: "Math", teachers: ["Smith", "Jones"], notes: ["Bring calculator"] }),
    );
    expect(entry).toBe(
      [
        "* EXAM Math",
        "<2026-03-02 Mon 08:00-08:50>",
        "R101",
        "Smith, Jones",
        "Bring calculator",
      ].join("\n"),
    );
  });

  it("omits a notes line entirely when there are no notes", () => {
    const entry = orgEntry(item({ notes: [] }));
    expect(entry.endsWith("Smith")).toBe(true);
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

describe("buildOrgFileContent", () => {
  it("returns an empty string for no items", () => {
    expect(buildOrgFileContent([])).toBe("");
  });

  it("joins entries with a blank line and ends with a trailing newline", () => {
    const a = item({ subject: "Math" });
    const b = item({ subject: "Physics", keyword: "EXAM" });
    expect(buildOrgFileContent([a, b])).toBe(`${orgEntry(a)}\n\n${orgEntry(b)}\n`);
  });
});
