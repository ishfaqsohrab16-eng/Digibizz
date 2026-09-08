/**
 * The week a weekly M&E report covers.
 *
 * FRIDAY TO THURSDAY. The report week starts on Friday and runs to the
 * following Thursday - so the week of 4 September 2026 is Fri 4th through
 * Thu 10th, and the five teaching days in it are Fri, Mon, Tue, Wed, Thu.
 *
 * That is why the paper form heads its columns "Fri Mon Tue Wed Thurs". Read
 * against a Monday-to-Friday week the order looks like a typo; read against
 * this one it is simply chronological, which is what it always was.
 *
 * DELIBERATELY NOT utils/weekKey.js. That is the ISO Monday-to-Sunday week the
 * student feedback and leave modules run on, and it must keep meaning exactly
 * what it means there. Two different weeks in one system is a hazard, so the
 * difference is stated rather than hidden: this file never imports that one,
 * and its keys are dates rather than ISO week numbers so the two can never be
 * mistaken for each other.
 *
 * The process runs with TZ=Asia/Karachi (set in app.js), so every date here is
 * programme time. That matters more than usual: a week computed in UTC rolls
 * over five hours early, and a Thursday-evening lecture report would land in
 * the next week's report and be counted as missing from its own.
 */

/** ISO date, YYYY-MM-DD, in programme time. */
const isoDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (date, count) => {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + count);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

/**
 * The five teaching days, in the order they happen.
 *
 * `offset` is days from the Friday the week starts on, so Saturday and Sunday
 * (1 and 2) are simply absent - they are in the week and nobody teaches. The
 * stored key never depends on the display order, so reordering the columns
 * later cannot silently re-map a trainer's answers to different days.
 */
const DAYS = [
  { key: "fri", label: "Fri", offset: 0 },
  { key: "mon", label: "Mon", offset: 3 },
  { key: "tue", label: "Tue", offset: 4 },
  { key: "wed", label: "Wed", offset: 5 },
  { key: "thu", label: "Thurs", offset: 6 },
];

/**
 * The four criteria the paper form scores day by day.
 *
 * `auto` marks the one the system answers for itself and nobody may edit: a
 * lecture report was either filed that day or it was not, and the database is
 * the record of that.
 */
const DAILY_CRITERIA = [
  { key: "lecture_reports", label: "Daily Lecture Reports Submission", auto: true },
  { key: "course_mapping", label: "Course Mapping" },
  { key: "class_time", label: "Completion of 2 Hours Class Time" },
  { key: "presence", label: "Presence at center 1 Hour Prior to the class" },
];

/**
 * The four-point scale, used for both graded questions on the form.
 *
 * "Grading of Training Quality" and "Trainees' Feedback Submission" are both
 * judgements of how something went, and a shared scale makes them comparable
 * across trainers and weeks. Feedback used to be Yes/No, which recorded only
 * whether the exercise happened and not what it said.
 */
const QUALITY_GRADES = ["Excellent", "Good", "Satisfactory", "Poor"];

/** Friday is day 5, counting from Sunday as 0. */
const FRIDAY = 5;

/** Midnight on the Friday that starts the report week containing `date`. */
const startOfReportWeek = (date = new Date()) => {
  const day = new Date(date.getTime());
  day.setHours(0, 0, 0, 0);

  // Days since the most recent Friday: Fri 0, Sat 1, Sun 2, Mon 3 ... Thu 6.
  // Saturday and Sunday therefore belong to the week that has just started,
  // not to the one about to.
  const since = (day.getDay() - FRIDAY + 7) % 7;
  return addDays(day, -since);
};

/**
 * Everything about the week containing `date`.
 *
 * The key is the starting Friday's date - "2026-09-04". A plain date rather
 * than an ISO week number, because this week is not an ISO week and borrowing
 * that notation would invite exactly the confusion the note above is trying to
 * prevent.
 */
const weekOf = (date = new Date()) => {
  const friday = startOfReportWeek(date);

  return {
    key: isoDate(friday),
    start: isoDate(friday),
    end: isoDate(addDays(friday, 6)),
    days: DAYS.map((day) => ({
      key: day.key,
      label: day.label,
      date: isoDate(addDays(friday, day.offset)),
    })),
  };
};

/**
 * The week a key names.
 *
 * A key that is not a Friday is refused rather than snapped to one. It can
 * only have come from a hand-written request or a stale link, and quietly
 * moving it would file a report against a week nobody asked for.
 */
const weekFromKey = (key) => {
  const text = String(key || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;

  const date = new Date(`${text}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  // Rejects impossible dates that Date happily rolls over, like 2026-02-31.
  if (isoDate(date) !== text) return null;
  if (date.getDay() !== FRIDAY) return null;

  return weekOf(date);
};

/**
 * The weeks a report may be filed for, newest first.
 *
 * The CURRENT week is included: a report is due at the end of it and an MT
 * finishing their Thursday visit should not have to wait for Friday. Future
 * weeks are not - there is nothing to evaluate yet, and a report filed in
 * advance would be a guess with a signature on it.
 */
const recentWeeks = (count = 12, from = new Date()) => {
  const weeks = [];
  let cursor = startOfReportWeek(from);

  for (let index = 0; index < count; index += 1) {
    weeks.push(weekOf(cursor));
    cursor = addDays(cursor, -7);
  }

  return weeks;
};

/** Is this a week that can be reported on yet? */
const isReportable = (week, now = new Date()) => {
  if (!week) return false;
  return week.start <= isoDate(startOfReportWeek(now));
};

/**
 * The first week this module is responsible for.
 *
 * Everything before it was done on paper. Those reports exist, in a folder,
 * signed - they are simply not in here, and chasing a Master Trainer for them
 * would be asking them to do the same work twice. So the reminder and the
 * admin "not submitted" count both start here.
 *
 * A week before this can still be FILLED IN, deliberately: someone typing up a
 * paper report from March should be able to. It is only never chased.
 *
 * Set as a date in any week - EVALUATION_START_WEEK=2026-09-04 - or leave it,
 * in which case it is the week the module went live. A fixed default rather
 * than "the current week" on purpose: a default that moves would quietly
 * forgive last week's missing reports every Friday morning.
 */
const START_WEEK = (() => {
  const configured = process.env.EVALUATION_START_WEEK;
  if (configured) {
    const parsed = new Date(`${configured}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) return weekOf(parsed).start;
    console.warn(
      `[evaluation] EVALUATION_START_WEEK="${configured}" is not a date; using the default`
    );
  }
  return "2026-09-04";
})();

/**
 * Should anyone be chased for this week?
 *
 * Reportable AND at or after the week this module took over. The two are
 * different questions: a week from last March is perfectly reportable and
 * nobody should be reminded about it.
 */
const isChased = (week, now = new Date()) =>
  isReportable(week, now) && Boolean(week) && week.start >= START_WEEK;

module.exports = {
  weekOf,
  weekFromKey,
  recentWeeks,
  isReportable,
  isChased,
  START_WEEK,
  isoDate,
  startOfReportWeek,
  DAYS,
  DAILY_CRITERIA,
  QUALITY_GRADES,
};
