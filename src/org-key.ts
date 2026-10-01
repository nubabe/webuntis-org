import type { LessonItem } from "./webuntis-mapping";

/**
 * Deterministic identity for a lesson occurrence, stable across refetches of the same
 * underlying data. Mirrors the identity `mergeAdjacentExams` already treats as "the same
 * lesson" (start/end/subject) rather than relying on WebUntis's own `ids` field, whose
 * cross-fetch stability isn't guaranteed.
 */
export const entryKey = (item: LessonItem): string => `${item.start}|${item.end}|${item.subject}`;
