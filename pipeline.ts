import { Effect } from "effect";
import {
  SchoolyearsClient,
  TimetableClient,
  type TimetableEntry,
  type TimetableResourceType,
} from "@schnau/webuntis-api";
import { chunkDateRange, tomorrowDate, toIsoDate, type DateChunk } from "./date";
import {
  extractInfo,
  mergeAdjacentExams,
  toLessonItem,
  type ActiveEntryInfo,
  type LessonItem,
} from "./webuntis-mapping";

const CHUNK_DAYS = 30;
const CHUNK_CONCURRENCY = 4;

export interface DateRange {
  readonly start: string;
  readonly end: string;
}

export const resolveDateRange = (mode: "day" | "year") =>
  Effect.gen(function* () {
    if (mode === "day") {
      const date = tomorrowDate();
      return { start: date, end: date };
    }

    const schoolyears = yield* SchoolyearsClient;
    const list = yield* schoolyears.list;
    if (list.length === 0) {
      return yield* Effect.fail(new Error("WebUntis returned no school years."));
    }

    const today = toIsoDate(new Date());
    const current =
      list.find((sy) => sy.dateRange.start <= today && today <= sy.dateRange.end) ??
      list[list.length - 1];

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

export interface PartitionedActive {
  readonly active: ReadonlyArray<readonly [TimetableEntry, ActiveEntryInfo]>;
  readonly cancelledCount: number;
}

/** Separates entries with an assigned teacher (active) from cancelled ones (no teacher). */
export const partitionActive = (entries: ReadonlyArray<TimetableEntry>): PartitionedActive => {
  const withInfo = entries.map((entry) => [entry, extractInfo(entry)] as const);
  const active = withInfo.filter(
    (pair): pair is [TimetableEntry, ActiveEntryInfo] => pair[1].teacher !== null,
  );
  return { active, cancelledCount: entries.length - active.length };
};

export interface BuiltLessonItems {
  readonly items: ReadonlyArray<LessonItem>;
  readonly mergedCount: number;
}

/** Maps active entries to lesson items and folds split exam periods into single entries. */
export const buildLessonItems = (
  active: ReadonlyArray<readonly [TimetableEntry, ActiveEntryInfo]>,
): BuiltLessonItems => {
  const mapped = active.map(([entry, info]) => toLessonItem(entry, info));
  const items = mergeAdjacentExams(mapped);
  return { items, mergedCount: mapped.length - items.length };
};
