import { describe, expect, it } from "vitest";
import type { TimetableEntry, TimetableEntryPosition, TimetableEntryPositionResource } from "@schnau/webuntis-api";
import { partitionActive } from "./pipeline";

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

describe("partitionActive", () => {
  it("keeps a regular entry with a teacher assigned", () => {
    const result = partitionActive([baseEntry()]);
    expect(result.active).toHaveLength(1);
    expect(result.cancelledCount).toBe(0);
  });

  it("drops an entry with no teacher assigned (position cleared)", () => {
    const entry = baseEntry({ position2: [position("TEACHER", null)] });
    const result = partitionActive([entry]);
    expect(result.active).toHaveLength(0);
    expect(result.cancelledCount).toBe(1);
  });

  it("drops an entry flagged status CANCELLED even though the teacher position is still regular", () => {
    const entry = baseEntry({ status: "CANCELLED" });
    const result = partitionActive([entry]);
    expect(result.active).toHaveLength(0);
    expect(result.cancelledCount).toBe(1);
  });

  it("counts both kinds of cancellation together", () => {
    const noTeacher = baseEntry({ position2: [position("TEACHER", null)] });
    const cancelled = baseEntry({ status: "CANCELLED" });
    const regular = baseEntry();
    const result = partitionActive([noTeacher, cancelled, regular]);
    expect(result.active).toHaveLength(1);
    expect(result.cancelledCount).toBe(2);
  });
});
