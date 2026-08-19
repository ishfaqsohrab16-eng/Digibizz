/**
 * Course series for the earning reports.
 *
 * Every earning chart, table and stat card used to hardcode the same four
 * courses - `digital`, `awe`, `creative`, `technical` - as fixed object keys,
 * table columns and chart bars. A course renamed in the database stopped
 * matching those keys and silently reported zero, and a fifth course could
 * never appear at all.
 *
 * The reports now build their columns from the course names the API actually
 * returned, merged with the course list in the database so a course with no
 * earnings still shows a zero instead of vanishing.
 */

export interface CourseSeries {
  /** Lower-cased lookup key used inside the per-center row objects. */
  key: string;
  /** Human label as stored in the database, used for headers and legends. */
  label: string;
  /** Stable colour for charts. */
  color: string;
}

/**
 * Palette applied in order. Chosen to stay distinguishable in the printed PDF
 * report as well as on screen.
 */
export const COURSE_COLORS = [
  "#4F46E5",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#0EA5E9",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
  "#6366F1",
];

export const courseKey = (name: unknown): string =>
  String(name ?? "").trim().toLowerCase();

export const colorForIndex = (index: number): string =>
  COURSE_COLORS[index % COURSE_COLORS.length];

/**
 * Build the ordered series list from the course names present in the data,
 * optionally topped up with the course list from the database.
 *
 * `preferred` (the database list) comes first so column order stays stable
 * across batches; names seen only in the data are appended so historic rows
 * under a previous course name keep their column.
 */
export const buildCourseSeries = (
  fromData: Array<string | null | undefined>,
  preferred: Array<string | null | undefined> = []
): CourseSeries[] => {
  const seen = new Map<string, string>();

  for (const name of [...preferred, ...fromData]) {
    const label = String(name ?? "").trim();
    if (!label) continue;
    const key = courseKey(label);
    if (!seen.has(key)) seen.set(key, label);
  }

  return Array.from(seen.entries()).map(([key, label], index) => ({
    key,
    label,
    color: colorForIndex(index),
  }));
};

/** Sum one course column across rows that store counts under `series.key`. */
export const sumByCourse = (
  rows: Array<Record<string, any>>,
  key: string
): number =>
  rows.reduce((total, row) => total + (Number(row?.[key]) || 0), 0);
