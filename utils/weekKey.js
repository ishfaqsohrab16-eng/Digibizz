/**
 * ISO week keys, used to enforce "once per week, any day of that week".
 *
 * A week has to be a concrete, comparable value or the rule cannot be enforced
 * reliably: "within the last 7 days" would let a student submit on Sunday and
 * again the following Monday, which is twice in one calendar week and not what
 * was asked for. An ISO week key ("2026-W34") pins each submission to one
 * Monday-to-Sunday window, so a unique index can make a second submission
 * physically impossible rather than merely checked for.
 *
 * The process runs with TZ=Asia/Karachi (set in app.js), so the local date
 * methods used here are already program time. A UTC-based week would roll over
 * five hours early and let a Sunday-evening submission count as the next week.
 */

/** Midnight local time, so week arithmetic is not skewed by the clock time. */
const atMidnight = (date) => {
  const copy = new Date(date.getTime());
  copy.setHours(0, 0, 0, 0);
  return copy;
};

/**
 * The Monday that starts the ISO week containing `date`.
 * getDay() is 0 for Sunday, which ISO treats as the LAST day of the week - the
 * off-by-one that makes naive implementations put Sunday in the wrong week.
 */
const startOfIsoWeek = (date = new Date()) => {
  const day = atMidnight(date);
  const weekday = day.getDay() === 0 ? 7 : day.getDay(); // Mon=1 .. Sun=7
  day.setDate(day.getDate() - (weekday - 1));
  return day;
};

/** The Sunday that ends the ISO week containing `date`, at 23:59:59.999. */
const endOfIsoWeek = (date = new Date()) => {
  const end = startOfIsoWeek(date);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
};

/**
 * ISO-8601 week key, e.g. "2026-W34".
 *
 * The year is the ISO week-numbering year, which is not always the calendar
 * year: 1 January can fall in week 52 or 53 of the previous year. Using the
 * calendar year would produce two different weeks sharing one key across a
 * new-year boundary, and the unique index would then reject a legitimate
 * submission.
 */
const isoWeekKey = (date = new Date()) => {
  const monday = startOfIsoWeek(date);
  // The Thursday of an ISO week always falls in that week's numbering year.
  const thursday = new Date(monday.getTime());
  thursday.setDate(thursday.getDate() + 3);

  const year = thursday.getFullYear();
  const firstThursday = new Date(year, 0, 4); // 4 Jan is always in week 1
  const firstMonday = startOfIsoWeek(firstThursday);

  const week =
    Math.round((monday.getTime() - firstMonday.getTime()) / (7 * 86400000)) + 1;

  return `${year}-W${String(week).padStart(2, "0")}`;
};

/** `YYYY-MM-DD` in local (program) time - never toISOString, which is UTC. */
const localDateKey = (date = new Date()) => {
  const d = atMidnight(date);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};

/** `YYYY-MM`, stable and sortable - unlike a localised month name. */
const monthKey = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** Human label for the current week, for messages shown to the student. */
const weekLabel = (date = new Date()) => {
  const start = startOfIsoWeek(date);
  const end = endOfIsoWeek(date);
  const fmt = (d) =>
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${fmt(start)} to ${fmt(end)}`;
};

module.exports = {
  startOfIsoWeek,
  endOfIsoWeek,
  isoWeekKey,
  localDateKey,
  monthKey,
  weekLabel,
};
