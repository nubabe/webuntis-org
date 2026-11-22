import { existsSync, readFileSync } from "node:fs";
import type { LessonItem } from "./webuntis-mapping";

const RULES_FILE_PATH = "data/rules.json";

interface SubjectTagRule {
  readonly match: string;
  readonly tag: string;
}

export interface Rules {
  readonly excludeSubjects: ReadonlyArray<string>;
  readonly subjectTags: ReadonlyArray<SubjectTagRule>;
}

const NO_RULES: Rules = { excludeSubjects: [], subjectTags: [] };

/**
 * rules.json is optional: without it nothing is excluded and every subject gets its slugified
 * fallback tag. `existsSync` follows symlinks, so a home-manager `rules` path pointing at a
 * file that doesn't exist yet counts as missing too.
 */
export const loadRules = (): Rules =>
  existsSync(RULES_FILE_PATH) ? JSON.parse(readFileSync(RULES_FILE_PATH, "utf8")) : NO_RULES;

export interface TaggedLessonItem extends LessonItem {
  readonly tags: ReadonlyArray<string>;
}

/** Lowercase, diacritic-free, hyphen-separated fallback tag for subjects with no explicit rule. */
export const slugify = (subject: string): string =>
  subject
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/gi, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const matches = (subject: string, pattern: string): boolean =>
  subject.toLowerCase().includes(pattern.toLowerCase());

const tagFor = (subject: string, subjectTags: ReadonlyArray<SubjectTagRule>): string =>
  subjectTags.find((rule) => matches(subject, rule.match))?.tag ?? slugify(subject);

/** Drops entries whose subject matches an exclude rule, tags the rest by subject. */
export const applyAutomaticRules = (
  items: ReadonlyArray<LessonItem>,
  rules: Rules,
): ReadonlyArray<TaggedLessonItem> =>
  items
    .filter((item) => !rules.excludeSubjects.some((pattern) => matches(item.subject, pattern)))
    .map((item) => ({ ...item, tags: [tagFor(item.subject, rules.subjectTags)] }));
