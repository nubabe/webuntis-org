export interface ParsedEntry {
  readonly key: string;
  readonly text: string;
}

const UNTIS_KEY_LINE = /^:UNTIS_KEY: (.+)$/m;

/**
 * Parses the small, self-controlled org subset `org-format.ts` generates (blank-line
 * separated entries, each carrying a `:UNTIS_KEY:` property) back into keyed blocks.
 * Not a general org parser — see the "headless Emacs" note in the plan for why that's fine
 * for this fixed format, and when it would stop being fine.
 *
 * Blocks without a recognizable `:UNTIS_KEY:` (e.g. content a human added outside any
 * generated entry) are silently skipped — they aren't ours to track.
 */
export const parseOrgEntries = (orgText: string): ReadonlyArray<ParsedEntry> =>
  orgText
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .flatMap((text) => {
      const match = UNTIS_KEY_LINE.exec(text);
      return match ? [{ key: match[1], text }] : [];
    });
