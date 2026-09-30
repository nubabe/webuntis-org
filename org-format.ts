import { formatTime, toIsoDate } from "./date";
import { entryKey } from "./org-key";
import type { OrgIdRegistry } from "./org-id-registry";
import type { LessonItem } from "./webuntis-mapping";
import type { TaggedLessonItem } from "./rules";

const WEEKDAY_ABBREVIATIONS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const orgTimestamp = (item: LessonItem): string => {
  const start = new Date(item.start);
  const weekday = WEEKDAY_ABBREVIATIONS[start.getDay()];
  return `<${toIsoDate(start)} ${weekday} ${formatTime(item.start)}-${formatTime(item.end)}>`;
};

const headline = (item: TaggedLessonItem): string => {
  const tags = item.tags.length > 0 ? ` :${item.tags.join(":")}:` : "";
  return `* ${item.keyword} ${item.subject}${tags}`;
};

export const orgEntry = (item: TaggedLessonItem, orgIds: OrgIdRegistry): string => {
  const key = entryKey(item);
  const id = orgIds[key];
  if (id === undefined) {
    throw new Error(`No org-id assigned for entry ${key} — call ensureOrgIds first.`);
  }

  return [
    headline(item),
    ":PROPERTIES:",
    `:ID: ${id}`,
    `:UNTIS_KEY: ${key}`,
    ":END:",
    orgTimestamp(item),
    item.room,
    item.teachers.join(", "),
    ...item.notes,
  ].join("\n");
};

export const consoleLine = (item: LessonItem): string => {
  const date = toIsoDate(new Date(item.start));
  const time = `${formatTime(item.start)}-${formatTime(item.end)}`;
  const notes = item.notes.length > 0 ? ` — ${item.notes.join(" ")}` : "";
  return `  ${date} ${time}  ${item.subject}, ${item.room}, ${item.teachers.join(", ")}${notes}`;
};

/** Joins pre-rendered org entry blocks into full file content (empty string when there are none). */
export const joinOrgBlocks = (blocks: ReadonlyArray<string>): string =>
  blocks.length === 0 ? "" : `${blocks.join("\n\n")}\n`;

/** Renders lesson items as the full timetable.org file content (empty string when there are none). */
export const buildOrgFileContent = (items: ReadonlyArray<TaggedLessonItem>, orgIds: OrgIdRegistry): string =>
  joinOrgBlocks(items.map((item) => orgEntry(item, orgIds)));
