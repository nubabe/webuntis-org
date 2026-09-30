import { describe, expect, it } from "vitest";
import { applyAutomaticRules, slugify, type Rules } from "./rules";
import type { LessonItem } from "./webuntis-mapping";

const item = (overrides: Partial<LessonItem> = {}): LessonItem => ({
  keyword: "CLASS",
  start: "2026-03-02T08:00:00",
  end: "2026-03-02T08:50:00",
  subject: "Mathematik",
  teachers: ["Smith"],
  room: "R101",
  notes: [],
  ...overrides,
});

const rules: Rules = {
  excludeSubjects: ["Philosophie", "Latein"],
  subjectTags: [
    { match: "Englisch", tag: "english" },
    { match: "Sozialwissenschaften", tag: "sowi" },
    { match: "Spanisch", tag: "spanish" },
  ],
};

describe("slugify", () => {
  it("lowercases and hyphenates punctuation/spaces", () => {
    expect(slugify("Kath. Religionslehre")).toBe("kath-religionslehre");
  });

  it("strips diacritics and expands ß", () => {
    expect(slugify("Straße")).toBe("strasse");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("  Mathematik!")).toBe("mathematik");
  });
});

describe("applyAutomaticRules", () => {
  it("drops entries whose subject matches an exclude rule, case-insensitively", () => {
    const items = [item({ subject: "Praktische Philosophie" }), item({ subject: "Latein" })];
    expect(applyAutomaticRules(items, rules)).toEqual([]);
  });

  it("keeps entries that don't match any exclude rule", () => {
    const items = [item({ subject: "Mathematik" })];
    expect(applyAutomaticRules(items, rules)).toHaveLength(1);
  });

  it("tags entries by first-matching subjectTags rule", () => {
    const [result] = applyAutomaticRules([item({ subject: "Englisch" })], rules);
    expect(result.tags).toEqual(["english"]);
  });

  it("matches subjectTags as a substring, e.g. 'Spanisch ab 11'", () => {
    const [result] = applyAutomaticRules([item({ subject: "Spanisch ab 11" })], rules);
    expect(result.tags).toEqual(["spanish"]);
  });

  it("falls back to a slugified subject when no subjectTags rule matches", () => {
    const [result] = applyAutomaticRules([item({ subject: "Kath. Religionslehre" })], rules);
    expect(result.tags).toEqual(["kath-religionslehre"]);
  });
});
