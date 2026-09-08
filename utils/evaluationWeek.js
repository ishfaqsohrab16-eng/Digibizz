const { startOfIsoWeek, isoWeekKey } = require("./weekKey");

/**
 * The week a weekly M&E report covers.
 *
 * Monday to Friday, the five teaching days. The paper form lists its columns
 * as "Fri Mon Tue Wed Thurs" and the screen keeps that order, because the
 * people filling it in have the printed form in front of them - but the week
 * itself is the ordinary Monday-to-Friday one, and every date shown under a
 * column proves which day it is.
 *
 * Built on utils/weekKey.js so a report week is the SAME week the rest of the
 * application already means by "this week". Two definitions of a week in one
 * system is a bug waiting for a Sunday.
 *
 * The process runs with TZ=Asia/Karachi (set in app.js), so every date here is
 * programme time. That matters more than usual: a week computed in UTC rolls
 * over five hours early, and a Friday-evening lecture report would land in the
 * following week's report and be counted as missing from its own.
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
  return copy;
};

/**
 * The five teaching days, in the order the paper form prints them.
 *
 * `offset` is days from Monday, so the stored key never depends on the display
 * order. Reordering the columns later cannot silently re-map a trainer's
 * answers to different days.
 */
const DAYS = [
  { key: "fri", label: "Fri", offset: 4 },
  { key: "mon", label: "Mon", offset: 0 },
  { key: "tue", label: "Tue", offset: 1 },
  { key: "wed", label: "Wed", offset: 2 },
  { key: "thu", label: "Thurs", offset: 3 },
];

/** The four criteria the paper form scores day by day. */
const DAILY_CRITERIA = [
  {
    key: "lecture_reports",
    label: "Daily Lecture Reports Submission",
    // The only one the system can answer for itself.
    auto: true,
  },
  { key: "course_mapping", label: "Course Mapping" },
  { key: "class_time", label: "Completion of 2 Hours Class Time" },
  { key: "presence", label: "Presence at center 1 Hour Prior to the class" },
];

/** How the MT grades the week overall. */
const QUALITY_GRADES = ["Excellent", "Good", "Satisfactory", "Poor"];

/**
 * Everything about the week containing `date`.
 *
 * Returns the key a report is filed under, the Monday and Friday that bound
 * it, and the five days with their real dates - which is what the form heads
 * its columns with and what every metric query filters on.
 */
const weekOf = (date = new Date()) => {
  const monday = startOfIsoWeek(date);
  const friday = addDays(monday, 4);

  return {
    key: isoWeekKey(monday),
    start: isoDate(monday),
    end: isoDate(friday),
    days: DAYS.map((day) => ({
      key: day.key,
      label: day.label,
      date: isoDate(addDays(monday, day.offset)),
    })),
  };
};

/** The week a key names, so a stored report can be rebuilt from its key alone. */
const weekFromKey = (key) => {
  const match = String(key || "").match(/^(\d{4})-W(\d{1,2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;

  // 4 January is always in ISO week 1, so counting from its Monday lands on
  // the Monday of any week without needing a calendar table.
  const firstMonday = startOfIsoWeek(new Date(year, 0, 4));
  const monday = addDays(firstMonday, (week - 1) * 7);

  const resolved = weekOf(monday);
  // A key naming week 53 of a 52-week year resolves into the next year; that
  // is not the week that was asked for.
  return resolved.key === `${year}-W${String(week).padStart(2, "0")}` ? resolved : null;
};

/**
 * The weeks a report may be filed for, newest first.
 *
 * The CURRENT week is included: a report is due at the end of it and an MT
 * visiting on Friday afternoon should not have to wait until Monday. Future
 * weeks are not - there is nothing to evaluate yet, and a report filed in
 * advance would be a guess with a signature on it.
 */
const recentWeeks = (count = 12, from = new Date()) => {
  const weeks = [];
  let cursor = startOfIsoWeek(from);

  for (let index = 0; index < count; index += 1) {
    weeks.push(weekOf(cursor));
    cursor = addDays(cursor, -7);
  }

  return weeks;
};

/** Is this a week that can be reported on yet? */
const isReportable = (week, now = new Date()) => {
  if (!week) return false;
  return week.start <= isoDate(startOfIsoWeek(now));
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
 * Set as a date in any week - EVALUATION_START_WEEK=2026-09-07 - or leave it,
 * in which case it is the week the module went live. A fixed default rather
 * than "the current week" on purpose: a default that moves would quietly
 * forgive last week's missing reports every Monday morning.
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
  return "2026-09-07";
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
  DAYS,
  DAILY_CRITERIA,
  QUALITY_GRADES,
};
