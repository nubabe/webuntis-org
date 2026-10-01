import { Effect } from "effect";
import {
  SchoolyearsClient,
  TimetableClient,
  type TimetableEntry,
  type TimetableResourceType,
} from "@schnau/webuntis-api";
import { chunkDateRange, toIsoDate, type DateChunk } from "./date";
import {
  extractInfo,
  mergeAdjacentExams,
  toLessonItem,
  type EntryInfo,
  type LessonItem,
} from "./webuntis-mapping";

const CHUNK_DAYS = 30;
const CHUNK_CONCURRENCY = 4;

export interface DateRange {
  readonly start: string;
  readonly end: string;
}

/** Resolves the current school year's date range, clamped to start no earlier than today. */
export const resolveDateRange = () =>
  Effect.gen(function* () {
    const schoolyears = yield* SchoolyearsClient;
    const list = yield* schoolyears.list;
    if (list.length === 0) {
      return yield* Effect.fail(new Error("WebUntis returned no school years."));
    }

    const today = toIsoDate(new Date());
    const matched = list.find((sy) => sy.dateRange.start <= today && today <= sy.dateRange.end);
    const current = matched ?? list[list.length - 1];

    if (matched === undefined) {
      console.warn(
        `No school year covers today (${today}); falling back to the most recent one: "${current.name}".`,
      );
    }
    console.log(`Using school year "${current.name}": ${current.dateRange.start} – ${current.dateRange.end}`);
    // Only fetch from today onward — dates before today are never regenerated (see
    // org-merge.ts's pastEntriesText), so there's nothing to gain from refetching them.
    const start = current.dateRange.start > today ? current.dateRange.start : today;
    return { start, end: current.dateRange.end };
  });

const fetchChunk = (
  timetable: TimetableClient["Service"],
  resourceType: TimetableResourceType,
  resourceId: number,
  chunk: DateChunk,
) =>
  timetable
    .getEntries({
      start: chunk.start,
      end: chunk.end,
      resourceType,
      resources: [resourceId],
    })
    .pipe(Effect.map((result) => result.days.flatMap((day) => day.gridEntries)));

/** Fetches all timetable entries for `range` in date-chunked, concurrent requests, sorted by start time. */
export const loadEntries = (
  timetable: TimetableClient["Service"],
  resourceType: TimetableResourceType,
  resourceId: number,
  range: DateRange,
) =>
  Effect.gen(function* () {
    const chunks = chunkDateRange(range.start, range.end, CHUNK_DAYS);

    const entryLists = yield* Effect.forEach(
      chunks,
      (chunk) => fetchChunk(timetable, resourceType, resourceId, chunk),
      { concurrency: CHUNK_CONCURRENCY },
    );

    const entries = entryLists
      .flat()
      .slice()
      .sort((a, b) => a.duration.start.localeCompare(b.duration.start));

    return { entries, chunkCount: chunks.length };
  });

export interface ClassifiedEntry {
  readonly entry: TimetableEntry;
  readonly info: EntryInfo;
  readonly cancelled: boolean;
}

/**
 * Classifies every entry as active or cancelled, preserving fetch order. Cancelled entries are
 * kept (not dropped) — `buildLessonItems` tags them with the CANCELED keyword instead, so they
 * still show up in the org file and can still be excluded by a subject rule. WebUntis signals
 * cancellation two different ways: either every teacher position is cleared (`info.teachers`
 * comes back empty), or the entry itself is flagged `status === "CANCELLED"` while every
 * position (including the teacher) stays REGULAR — e.g. a lesson cancelled outright rather than
 * left unstaffed.
 */
export const classifyEntries = (entries: ReadonlyArray<TimetableEntry>): ReadonlyArray<ClassifiedEntry> =>
  entries.map((entry) => {
    const info = extractInfo(entry);
    return { entry, info, cancelled: info.teachers.length === 0 || entry.status === "CANCELLED" };
  });

export interface BuiltLessonItems {
  readonly items: ReadonlyArray<LessonItem>;
  readonly mergedCount: number;
  readonly cancelledCount: number;
}

/**
 * Maps classified entries to lesson items — cancelled ones get the CANCELED keyword in place of
 * CLASS/EXAM — and folds split exam periods into single entries. CANCELED items never merge
 * with each other or with EXAM items; `mergeAdjacentExams` only merges matching EXAM keywords.
 */
export const buildLessonItems = (classified: ReadonlyArray<ClassifiedEntry>): BuiltLessonItems => {
  const mapped = classified.map(({ entry, info, cancelled }) => {
    const item = toLessonItem(entry, info);
    return cancelled ? { ...item, keyword: "CANCELED" as const } : item;
  });
  const items = mergeAdjacentExams(mapped);
  const cancelledCount = classified.filter((c) => c.cancelled).length;
  return { items, mergedCount: mapped.length - items.length, cancelledCount };
};
