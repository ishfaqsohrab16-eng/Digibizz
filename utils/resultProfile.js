/**
 * What a result set contains, as statistics rather than as rows.
 *
 * The assistant used to be handed up to 150 raw rows of every query and asked
 * to reason over them. That is expensive and, worse, it is unreliable: a query
 * can return the guard's full 500 rows, the model sees the first 150, and any
 * total, average or "how many" it states is quietly computed over a third of
 * the data. Nothing in the answer says so.
 *
 * So the model now gets a small sample AND a profile of the WHOLE result: the
 * true row count, and per column the range, sum, mean, how many values are
 * missing, and the commonest values. Two things follow from that:
 *
 *   It is correct. "The average mark is 61" comes from all 500 rows, not from
 *   the 150 it happened to be shown.
 *
 *   It is cheaper. The profile of a 500-row result is a few hundred tokens
 *   where the rows were several thousand, and every round of the conversation
 *   carries it again.
 *
 * The rows themselves still go to the browser in full - the table, the chart
 * and the Excel export are all built from them. This is only about what the
 * model has to read to describe them.
 */

/** Values sampled per column when working out what kind of column it is. */
const TYPE_SAMPLE = 50;

/** Distinct values listed for a categorical column. */
const TOP_VALUES = 4;

const isMissing = (value) => value === null || value === undefined || value === "";

/**
 * Is this a number?
 *
 * Deliberately strict about strings. Marks are stored as text in this database
 * and should be treated as numbers, but a roll number like "010" or a CNIC is
 * text that happens to contain digits, and averaging it would be nonsense
 * presented as insight. Numeric strings count only when the column is
 * consistently numeric AND the values are not zero-padded.
 */
const looksNumeric = (value) => {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;

  const trimmed = value.trim();
  if (!trimmed || !/^-?\d+(\.\d+)?$/.test(trimmed)) return false;

  // "007" is an identifier, not a quantity.
  if (/^-?0\d/.test(trimmed)) return false;

  return Number.isFinite(Number(trimmed));
};

const isDate = (value) =>
  value instanceof Date ||
  (typeof value === "string" && /^\d{4}-\d{2}-\d{2}([ T]|$)/.test(value));

const asNumber = (value) => (typeof value === "number" ? value : Number(String(value).trim()));

/** Round to at most two decimals without printing 61.00 for an integer. */
const tidy = (value) => {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? rounded : Number(rounded.toFixed(2));
};

const shorten = (value, max = 40) => {
  const text = String(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

/**
 * Describe every column of a result set.
 *
 * One pass for the type, one for the statistics. Both bounded by the guard's
 * 500-row cap, so this is cheap however wide the result is.
 */
const profileRows = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { rowCount: 0, columns: [] };
  }

  const names = Object.keys(rows[0] || {});
  const columns = [];

  for (const name of names) {
    const present = [];
    let missing = 0;

    for (const row of rows) {
      const value = row[name];
      if (isMissing(value)) missing += 1;
      else present.push(value);
    }

    const sample = present.slice(0, TYPE_SAMPLE);

    // A column counts as numeric or date only if EVERY value it has agrees.
    // One stray string in a column of numbers usually means the column is not
    // what it looks like, and averaging it would be worse than not trying.
    const numeric = sample.length > 0 && sample.every(looksNumeric);
    const dated = !numeric && sample.length > 0 && sample.every(isDate);

    const column = { name, missing, present: present.length };

    if (numeric) {
      column.type = "number";

      let min = Infinity;
      let max = -Infinity;
      let sum = 0;

      for (const value of present) {
        const n = asNumber(value);
        if (n < min) min = n;
        if (n > max) max = n;
        sum += n;
      }

      if (present.length > 0) {
        column.min = tidy(min);
        column.max = tidy(max);
        column.sum = tidy(sum);
        column.mean = tidy(sum / present.length);
      }
    } else if (dated) {
      column.type = "date";

      const stamps = present
        .map((value) => String(value instanceof Date ? value.toISOString() : value).slice(0, 10))
        .sort();

      column.earliest = stamps[0];
      column.latest = stamps[stamps.length - 1];
    } else {
      column.type = "text";

      const counts = new Map();
      for (const value of present) {
        const key = String(value);
        counts.set(key, (counts.get(key) || 0) + 1);
      }

      column.distinct = counts.size;

      // Only worth listing when the column really is categorical. A column of
      // 500 distinct names tells you nothing by its top four.
      if (counts.size > 0 && counts.size <= Math.max(TOP_VALUES * 3, present.length / 2)) {
        column.top = [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, TOP_VALUES)
          .map(([value, count]) => ({ value: shorten(value), count }));
      }
    }

    columns.push(column);
  }

  return { rowCount: rows.length, columns };
};

/**
 * The profile as one compact block of text for the prompt.
 *
 * Prose, not JSON: the same facts cost fewer tokens, and this is paid on every
 * round of the conversation for every dataset that is still in play.
 */
const describeProfile = (profile) => {
  if (!profile || profile.rowCount === 0) return "no rows";

  const lines = profile.columns.map((column) => {
    const parts = [];

    if (column.type === "number") {
      if (column.present > 0) {
        parts.push(`${column.min} to ${column.max}`, `total ${column.sum}`, `mean ${column.mean}`);
      }
    } else if (column.type === "date") {
      parts.push(`${column.earliest} to ${column.latest}`);
    } else {
      parts.push(`${column.distinct} distinct`);
      if (column.top) {
        parts.push(column.top.map((entry) => `${entry.value} (${entry.count})`).join(", "));
      }
    }

    if (column.missing > 0) parts.push(`${column.missing} missing`);

    return `  ${column.name} [${column.type}]: ${parts.join("; ")}`;
  });

  return `${profile.rowCount} row(s)\n${lines.join("\n")}`;
};

module.exports = { profileRows, describeProfile, _internals: { looksNumeric, isDate, tidy } };
