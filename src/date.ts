export const toIsoDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const addDays = (isoDate: string, days: number): string => {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
};

export const formatTime = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export interface DateChunk {
  readonly start: string;
  readonly end: string;
}

/** Splits [start, end] (inclusive, YYYY-MM-DD) into non-overlapping chunks of at most `size` days. */
export const chunkDateRange = (start: string, end: string, size: number): ReadonlyArray<DateChunk> => {
  if (size <= 0) {
    throw new Error(`chunkDateRange size must be positive, got ${size}.`);
  }

  const chunks: DateChunk[] = [];
  let chunkStart = start;
  while (chunkStart <= end) {
    const chunkEnd = addDays(chunkStart, size - 1);
    chunks.push({ start: chunkStart, end: chunkEnd < end ? chunkEnd : end });
    chunkStart = addDays(chunkEnd, 1);
  }
  return chunks;
};
