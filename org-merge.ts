import { parseOrgEntries } from "./org-parse";

/** The `YYYY-MM-DD` date portion of a `:UNTIS_KEY:` value (`start|end|subject`). */
const dateOf = (key: string): string => key.slice(0, 10);

/**
 * Text of entries from a previously-written org file that fall strictly before `todayIso`.
 * Once an entry's date is in the past it's never refetched or regenerated again (see
 * `resolveDateRange` in pipeline.ts), so its exact previous text — including any manual
 * edits — is preserved verbatim instead of being diffed/captured/replayed.
 */
export const pastEntriesText = (
  previousOrgText: string,
  todayIso: string,
): ReadonlyArray<string> =>
  parseOrgEntries(previousOrgText)
    .filter((entry) => dateOf(entry.key) < todayIso)
    .map((entry) => entry.text);
