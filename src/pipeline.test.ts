import { describe, expect, it } from "vitest";
import type { TimetableEntry, TimetableEntryPosition, TimetableEntryPositionResource } from "@schnau/webuntis-api";
import { buildLessonItems, classifyEntries } from "./pipeline";

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

describe("classifyEntries", () => {
  it("keeps a regular entry with a teacher assigned, marked not cancelled", () => {
    const result = classifyEntries([baseEntry()]);
    expect(result).toHaveLength(1);
    expect(result[0].cancelled).toBe(false);
  });

  it("marks an entry with no teacher assigned (position cleared) as cancelled", () => {
    const entry = baseEntry({ position2: [position("TEACHER", null)] });
    const result = classifyEntries([entry]);
    expect(result[0].cancelled).toBe(true);
  });

  it("marks an entry flagged status CANCELLED as cancelled even though the teacher position is still regular", () => {
    const entry = baseEntry({ status: "CANCELLED" });
    const result = classifyEntries([entry]);
    expect(result[0].cancelled).toBe(true);
  });

  it("preserves fetch order instead of splitting active from cancelled", () => {
    const noTeacher = baseEntry({ position2: [position("TEACHER", null)] });
    const regular = baseEntry();
    const result = classifyEntries([noTeacher, regular]);
    expect(result.map((c) => c.cancelled)).toEqual([true, false]);
  });
});

describe("buildLessonItems", () => {
  it("keeps a regular entry with its mapped keyword", () => {
    const { items, cancelledCount } = buildLessonItems(classifyEntries([baseEntry()]));
    expect(items).toHaveLength(1);
    expect(items[0].keyword).toBe("CLASS");
    expect(cancelledCount).toBe(0);
  });

  it("tags a cancelled entry (no teacher) with the CANCELED keyword instead of dropping it", () => {
    const entry = baseEntry({ position2: [position("TEACHER", null)] });
    const { items, cancelledCount } = buildLessonItems(classifyEntries([entry]));
    expect(items).toHaveLength(1);
    expect(items[0].keyword).toBe("CANCELED");
    expect(cancelledCount).toBe(1);
  });

  it("tags an entry flagged status CANCELLED with the CANCELED keyword instead of dropping it", () => {
    const entry = baseEntry({ status: "CANCELLED" });
    const { items, cancelledCount } = buildLessonItems(classifyEntries([entry]));
    expect(items).toHaveLength(1);
    expect(items[0].keyword).toBe("CANCELED");
    expect(cancelledCount).toBe(1);
  });

  it("counts both kinds of cancellation together", () => {
    const noTeacher = baseEntry({ position2: [position("TEACHER", null)] });
    const cancelled = baseEntry({ status: "CANCELLED" });
    const regular = baseEntry();
    const { items, cancelledCount } = buildLessonItems(classifyEntries([noTeacher, cancelled, regular]));
    expect(items).toHaveLength(3);
    expect(cancelledCount).toBe(2);
  });

  it("does not merge a cancelled exam with an adjacent active exam of the same subject", () => {
    const cancelledExam = baseEntry({
      type: "EXAM",
      position2: [position("TEACHER", null)],
      duration: { start: "2026-03-02T08:00:00", end: "2026-03-02T08:50:00" },
    });
    const activeExam = baseEntry({
      type: "EXAM",
      duration: { start: "2026-03-02T08:50:00", end: "2026-03-02T09:40:00" },
    });
    const { items } = buildLessonItems(classifyEntries([cancelledExam, activeExam]));
    expect(items).toHaveLength(2);
    expect(items[0].keyword).toBe("CANCELED");
    expect(items[1].keyword).toBe("EXAM");
  });
});
