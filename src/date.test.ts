import { describe, expect, it } from "vitest";
import { addDays, chunkDateRange, toIsoDate } from "./date";

describe("toIsoDate", () => {
  it("formats a date as YYYY-MM-DD with zero-padding", () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toIsoDate(new Date(2026, 10, 30))).toBe("2026-11-30");
  });
});

describe("addDays", () => {
  it("adds days within the same month", () => {
    expect(addDays("2026-03-01", 5)).toBe("2026-03-06");
  });

  it("rolls over into the next month", () => {
    expect(addDays("2026-01-30", 3)).toBe("2026-02-02");
  });

  it("rolls over into the next year", () => {
    expect(addDays("2026-12-30", 5)).toBe("2027-01-04");
  });

  it("supports negative offsets", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("chunkDateRange", () => {
  it("returns a single chunk when the range fits within the chunk size", () => {
    expect(chunkDateRange("2026-01-01", "2026-01-05", 30)).toEqual([
      { start: "2026-01-01", end: "2026-01-05" },
    ]);
  });

  it("returns a single chunk for a single-day range", () => {
    expect(chunkDateRange("2026-01-01", "2026-01-01", 30)).toEqual([
      { start: "2026-01-01", end: "2026-01-01" },
    ]);
  });

  it("splits a range longer than the chunk size, truncating the last chunk", () => {
    expect(chunkDateRange("2026-01-01", "2026-02-05", 30)).toEqual([
      { start: "2026-01-01", end: "2026-01-30" },
      { start: "2026-01-31", end: "2026-02-05" },
    ]);
  });

  it("produces exact-size chunks when the range divides evenly", () => {
    expect(chunkDateRange("2026-01-01", "2026-01-20", 10)).toEqual([
      { start: "2026-01-01", end: "2026-01-10" },
      { start: "2026-01-11", end: "2026-01-20" },
    ]);
  });

  it("throws instead of looping forever when size is not positive", () => {
    expect(() => chunkDateRange("2026-01-01", "2026-01-05", 0)).toThrow(/positive/);
    expect(() => chunkDateRange("2026-01-01", "2026-01-05", -1)).toThrow(/positive/);
  });
});
