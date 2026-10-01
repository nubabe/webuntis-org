import { describe, expect, it } from "vitest";
import type { TimetableEntry, TimetableEntryPosition, TimetableEntryPositionResource } from "@schnau/webuntis-api";
import { extractInfo, mergeAdjacentExams, toLessonItem, type EntryInfo, type LessonItem } from "./webuntis-mapping";

const resource = (
  type: string,
  displayName: string,
  longName = displayName,
): TimetableEntryPositionResource => ({
  type,
  status: "REGULAR",
  shortName: displayName,
  longName,
  displayName,
  displayNameLabel: null,
});

const position = (
  type: string,
  current: { displayName: string; longName?: string } | null,
  removed: { displayName: string; longName?: string } | null = null,
): TimetableEntryPosition => ({
  current: current ? resource(type, current.displayName, current.longName) : null,
  removed: removed ? resource(type, removed.displayName, removed.longName) : null,
});

const baseEntry = (overrides: Partial<TimetableEntry> = {}): TimetableEntry => ({
  duration: { start: "2026-03-02T08:00:00", end: "2026-03-02T08:50:00" },
  type: "NORMAL_TEACHING_PERIOD",
  status: "REGULAR",
  layoutStartPosition: 0,
  layoutWidth: 1,
  color: "#ffffff",
  notesAll: null,
  ids: [1],
  layoutGroup: 0,
  icons: [],
  position1: [position("SUBJECT", { displayName: "Math" })],
  position2: [position("TEACHER", { displayName: "Smith" })],
  position3: [position("ROOM", { displayName: "R101" })],
  position4: null,
  texts: [],
  lessonText: null,
  lessonInfo: null,
  substitutionText: null,
  ...overrides,
});

describe("extractInfo", () => {
  it("resolves subject/teacher/room from current positions", () => {
    const info = extractInfo(baseEntry());
    expect(info).toEqual({
      subject: "Math",
      teachers: ["Smith"],
      room: "R101",
      notes: [],
    });
  });

  it("treats a null current teacher as a cancelled lesson", () => {
    const info = extractInfo(
      baseEntry({ position2: [position("TEACHER", null, { displayName: "Smith" })] }),
    );
    expect(info.teachers).toEqual([]);
  });

  it("collects more than one concurrent teacher position (team teaching)", () => {
    const info = extractInfo(
      baseEntry({
        position2: [position("TEACHER", { displayName: "Smith" }), position("TEACHER", { displayName: "Jones" })],
      }),
    );
    expect(info.teachers).toEqual(["Smith", "Jones"]);
  });

  it("falls back to the removed room when current room is cleared (exam vacates room)", () => {
    const info = extractInfo(
      baseEntry({ position3: [position("ROOM", null, { displayName: "R101" })] }),
    );
    expect(info.room).toBe("R101");
  });

  it("does not fall back to a removed subject or teacher (only room does)", () => {
    const info = extractInfo(
      baseEntry({ position1: [position("SUBJECT", null, { displayName: "Math" })] }),
    );
    expect(info.subject).toBe("(unknown subject)");
  });

  it("falls back to '(unknown room)' when no room position exists at all", () => {
    const info = extractInfo(baseEntry({ position3: null }));
    expect(info.room).toBe("(unknown room)");
  });

  it("collects and de-duplicates notes from texts, lessonText, lessonInfo, substitutionText", () => {
    const info = extractInfo(
      baseEntry({
        texts: [{ type: "INFO", text: "Bring calculator" }],
        lessonText: "Chapter 4",
        lessonInfo: "Bring calculator",
        substitutionText: "  ",
      }),
    );
    expect(info.notes).toEqual(["Bring calculator", "Chapter 4"]);
  });
});

describe("toLessonItem", () => {
  it("maps an EXAM entry to keyword EXAM, others to CLASS", () => {
    const info: EntryInfo = { subject: "Math", teachers: ["Smith"], room: "R101", notes: [] };
    expect(toLessonItem(baseEntry({ type: "EXAM" }), info).keyword).toBe("EXAM");
    expect(toLessonItem(baseEntry({ type: "NORMAL_TEACHING_PERIOD" }), info).keyword).toBe("CLASS");
  });
});

const exam = (overrides: Partial<LessonItem> = {}): LessonItem => ({
  keyword: "EXAM",
  start: "2026-03-02T08:00:00",
  end: "2026-03-02T08:50:00",
  subject: "Math",
  teachers: ["Smith"],
  room: "R101",
  notes: [],
  ...overrides,
});

describe("mergeAdjacentExams", () => {
  it("merges adjacent same-subject, same-notes exams into one", () => {
    const first = exam({ end: "2026-03-02T08:50:00" });
    const second = exam({
      start: "2026-03-02T08:50:00",
      end: "2026-03-02T09:40:00",
      teachers: ["Jones"],
    });
    const result = mergeAdjacentExams([first, second]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      start: "2026-03-02T08:00:00",
      end: "2026-03-02T09:40:00",
      teachers: ["Smith", "Jones"],
    });
  });

  it("keeps exams with different subjects separate", () => {
    const first = exam({ subject: "Math" });
    const second = exam({ subject: "Physics", start: first.end });
    expect(mergeAdjacentExams([first, second])).toHaveLength(2);
  });

  it("keeps non-adjacent (gapped) exams separate", () => {
    const first = exam({ end: "2026-03-02T08:50:00" });
    const second = exam({ start: "2026-03-02T10:00:00", end: "2026-03-02T10:50:00" });
    expect(mergeAdjacentExams([first, second])).toHaveLength(2);
  });

  it("does not merge CLASS items", () => {
    const first = exam({ keyword: "CLASS" });
    const second = exam({ keyword: "CLASS", start: first.end });
    expect(mergeAdjacentExams([first, second])).toHaveLength(2);
  });

  it("prefers a known room over '(unknown room)' when merging", () => {
    const first = exam({ room: "(unknown room)", end: "2026-03-02T08:50:00" });
    const second = exam({ room: "R202", start: "2026-03-02T08:50:00" });
    expect(mergeAdjacentExams([first, second])[0].room).toBe("R202");
  });
});
