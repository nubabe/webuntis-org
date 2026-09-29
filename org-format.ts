import { formatTime, toIsoDate } from "./date";
import type { LessonItem } from "./webuntis-mapping";

const WEEKDAY_ABBREVIATIONS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const orgTimestamp = (item: LessonItem): string => {
  const start = new Date(item.start);
  const weekday = WEEKDAY_ABBREVIATIONS[start.getDay()];
  return `<${toIsoDate(start)} ${weekday} ${formatTime(item.start)}-${formatTime(item.end)}>`;
};

export const orgEntry = (item: LessonItem): string =>
  [
    `* ${item.keyword} ${item.subject}`,
    orgTimestamp(item),
    item.room,
    item.teachers.join(", "),
    ...item.notes,
  ].join("\n");

export const consoleLine = (item: LessonItem): string => {
  const date = toIsoDate(new Date(item.start));
  const time = `${formatTime(item.start)}-${formatTime(item.end)}`;
  const notes = item.notes.length > 0 ? ` — ${item.notes.join(" ")}` : "";
  return `  ${date} ${time}  ${item.subject}, ${item.room}, ${item.teachers.join(", ")}${notes}`;
};

/** Renders lesson items as the full timetable.org file content (empty string when there are none). */
export const buildOrgFileContent = (items: ReadonlyArray<LessonItem>): string =>
  items.length === 0 ? "" : `${items.map(orgEntry).join("\n\n")}\n`;
