import { describe, expect, it } from "vitest";
import { entryKey } from "./org-key";
import type { LessonItem } from "./webuntis-mapping";

const item = (overrides: Partial<LessonItem> = {}): LessonItem => ({
  keyword: "CLASS",
  start: "2026-03-02T08:00:00",
  end: "2026-03-02T08:50:00",
  subject: "Mathematik",
  teachers: ["Smith"],
  room: "R101",
  notes: [],
  ...overrides,
});

describe("entryKey", () => {
  it("is deterministic for the same item shape", () => {
    expect(entryKey(item())).toBe(entryKey(item()));
  });

  it("differs when start differs", () => {
    expect(entryKey(item({ start: "2026-03-02T09:00:00" }))).not.toBe(entryKey(item()));
  });

  it("differs when end differs", () => {
    expect(entryKey(item({ end: "2026-03-02T09:50:00" }))).not.toBe(entryKey(item()));
  });

  it("differs when subject differs", () => {
    expect(entryKey(item({ subject: "Physik" }))).not.toBe(entryKey(item()));
  });

  it("is unaffected by fields outside start/end/subject (room, teachers, notes, keyword)", () => {
    const a = item({ room: "R1", teachers: ["A"], notes: ["x"], keyword: "EXAM" });
    const b = item({ room: "R2", teachers: ["B"], notes: [], keyword: "CLASS" });
    expect(entryKey(a)).toBe(entryKey(b));
  });
});
