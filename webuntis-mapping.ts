import type { TimetableEntry } from "@schnau/webuntis-api";

/** WebUntis reuses the CLASS/ROOM/SUBJECT/TEACHER vocabulary on each position's `type`. */
const POSITION_TYPE = {
  SUBJECT: "SUBJECT",
  TEACHER: "TEACHER",
  ROOM: "ROOM",
} as const;

const UNKNOWN_SUBJECT = "(unknown subject)";
export const UNKNOWN_ROOM = "(unknown room)";

export interface EntryInfo {
  readonly subject: string;
  /** null means no teacher is assigned — at this school that means the lesson is cancelled. */
  readonly teacher: string | null;
  readonly room: string;
  readonly notes: ReadonlyArray<string>;
}

export interface ActiveEntryInfo extends EntryInfo {
  readonly teacher: string;
}

export const extractInfo = (entry: TimetableEntry): EntryInfo => {
  const positions = [entry.position1, entry.position2, entry.position3, entry.position4].flatMap(
    (p) => p ?? [],
  );

  // `current` is null when a position was cleared for this period (e.g. no teacher
  // assigned means the lesson is cancelled) — only fall back to `removed` for rooms,
  // where exam periods vacate the normal classroom without that meaning "no room".
  const byType = (type: string) =>
    positions.find((p) => p.current?.type.toUpperCase() === type)?.current;
  const byTypeAllowRemoved = (type: string) =>
    byType(type) ?? positions.find((p) => p.removed?.type.toUpperCase() === type)?.removed;
  const label = (resource: { longName: string; displayName: string } | undefined) =>
    resource?.longName || resource?.displayName;

  const subject = label(byType(POSITION_TYPE.SUBJECT)) ?? UNKNOWN_SUBJECT;
  const teacher = label(byType(POSITION_TYPE.TEACHER)) ?? null;
  // Some schools repurpose a room's longName for other labeling, so stick to the room code.
  const room = byTypeAllowRemoved(POSITION_TYPE.ROOM)?.displayName ?? UNKNOWN_ROOM;

  const notes = [
    ...entry.texts.map((t) => t.text),
    entry.lessonText,
    entry.lessonInfo,
    entry.substitutionText,
  ].filter((note): note is string => Boolean(note && note.trim().length > 0));

  return { subject, teacher, room, notes: [...new Set(notes)] };
};

export interface LessonItem {
  readonly keyword: "CLASS" | "EXAM";
  readonly start: string;
  readonly end: string;
  readonly subject: string;
  readonly teachers: ReadonlyArray<string>;
  readonly room: string;
  readonly notes: ReadonlyArray<string>;
}

export const toLessonItem = (entry: TimetableEntry, info: ActiveEntryInfo): LessonItem => ({
  keyword: entry.type === "EXAM" ? "EXAM" : "CLASS",
  start: entry.duration.start,
  end: entry.duration.end,
  subject: info.subject,
  teachers: [info.teacher],
  room: info.room,
  notes: info.notes,
});

/**
 * WebUntis splits one exam into multiple entries when the supervising teacher
 * changes partway through (e.g. a written exam handed off to a second teacher
 * for the last period). Adjacent/overlapping EXAM entries for the same subject
 * with the same notes are really one exam, so fold them into a single item.
 */
export const mergeAdjacentExams = (items: ReadonlyArray<LessonItem>): ReadonlyArray<LessonItem> => {
  const merged: LessonItem[] = [];

  for (const item of items) {
    const prev = merged.at(-1);
    const sameExam =
      prev !== undefined &&
      prev.keyword === "EXAM" &&
      item.keyword === "EXAM" &&
      prev.subject === item.subject &&
      prev.notes.join(" ") === item.notes.join(" ") &&
      item.start <= prev.end;

    if (prev !== undefined && sameExam) {
      merged[merged.length - 1] = {
        ...prev,
        end: item.end > prev.end ? item.end : prev.end,
        teachers: [...new Set([...prev.teachers, ...item.teachers])],
        room: prev.room !== UNKNOWN_ROOM ? prev.room : item.room,
      };
    } else {
      merged.push(item);
    }
  }

  return merged;
};
