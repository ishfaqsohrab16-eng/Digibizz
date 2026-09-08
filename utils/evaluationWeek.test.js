/**
 * Tests for the week a weekly M&E report covers.
 *
 * Run with:  node utils/evaluationWeek.test.js
 * Exits non-zero if any rule regresses.
 *
 * The week boundary decides every automatic figure on a signed report - how
 * many assignments were set, who was present on Tuesday, how many students
 * were enrolled at the start. An off-by-one here is not a display bug; it is a
 * wrong number on a document two people put their names to.
 */
process.env.TZ = "Asia/Karachi";

const {
  weekOf,
  weekFromKey,
  recentWeeks,
  isReportable,
  isChased,
  START_WEEK,
  DAYS,
  DAILY_CRITERIA,
  QUALITY_GRADES,
} = require("./evaluationWeek");

let passed = 0;
let failed = 0;

const check = (name, condition, detail) => {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? `  ->  ${detail}` : ""}`);
  }
};

const dayName = (iso) =>
  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(`${iso}T00:00:00`).getDay()];

console.log("\nFriday to Thursday\n");

// The week the change was specified against: Fri 4 Sep 2026 to Thu 10 Sep.
let week = weekOf(new Date(2026, 8, 8)); // Tuesday 8 September

check("the week starts on the Friday", week.start === "2026-09-04", week.start);
check("and that really is a Friday", dayName(week.start) === "Fri");
check("it ends on the Thursday", week.end === "2026-09-10", week.end);
check("and that really is a Thursday", dayName(week.end) === "Thu");
check("five teaching days", week.days.length === 5);

// Every day of the week has to resolve to the same week, or a Friday report
// and a Wednesday report disagree about which week they belong to.
for (const [day, label, expected] of [
  [4, "Friday", "2026-09-04"],
  [5, "Saturday", "2026-09-04"],
  [6, "Sunday", "2026-09-04"],
  [7, "Monday", "2026-09-04"],
  [8, "Tuesday", "2026-09-04"],
  [9, "Wednesday", "2026-09-04"],
  [10, "Thursday", "2026-09-04"],
  // The next Friday starts a NEW week. This is the boundary that matters.
  [11, "the next Friday", "2026-09-11"],
]) {
  const from = weekOf(new Date(2026, 8, day));
  check(`${label} belongs to ${expected}`, from.start === expected, from.start);
}

// The weekend belongs to the week that has just started, not the one about to.
// Getting this backwards moves every Saturday submission a week forward.
const saturday = weekOf(new Date(2026, 8, 5));
check("Saturday is inside the week that began the day before", saturday.end === "2026-09-10");

console.log("\nThe columns the paper form prints\n");

// "Fri Mon Tue Wed Thurs" is not an odd ordering - against a Friday-to-Thursday
// week it is simply chronological, which is what it always was.
check(
  "columns are in the paper's order",
  week.days.map((day) => day.label).join(" ") === "Fri Mon Tue Wed Thurs",
  week.days.map((day) => day.label).join(" ")
);

const byKey = Object.fromEntries(week.days.map((day) => [day.key, day.date]));
check("Friday is the first day of the week", byKey.fri === "2026-09-04", byKey.fri);
check("Monday follows the weekend", byKey.mon === "2026-09-07", byKey.mon);
check("Tuesday", byKey.tue === "2026-09-08");
check("Wednesday", byKey.wed === "2026-09-09");
check("Thursday is the last", byKey.thu === "2026-09-10", byKey.thu);

// The dates have to ascend down the row, or the columns are not chronological
// after all and the label order is misleading.
const dates = week.days.map((day) => day.date);
check(
  "and the dates ascend across the columns",
  dates.every((date, index) => index === 0 || date > dates[index - 1]),
  dates.join(" ")
);

// Saturday and Sunday are in the week and nobody teaches, so they have no
// column. Their absence is what makes five days out of seven.
check("no weekend columns", week.days.every((day) => !["sat", "sun"].includes(day.key)));
check("storage keys are day names", DAYS.every((day) => /^(fri|mon|tue|wed|thu)$/.test(day.key)));

console.log("\nRebuilding a week from its key\n");

const rebuilt = weekFromKey(week.key);
check("a key round-trips", rebuilt?.start === week.start, rebuilt?.start);
check("and keeps its dates", rebuilt?.end === "2026-09-10");
check("the key is the starting Friday", week.key === "2026-09-04", week.key);

// An ISO week key belongs to the OTHER week definition in this system - the
// one student feedback and leave run on. Accepting it here would silently mix
// two calendars.
check("an ISO week key is refused", weekFromKey("2026-W37") === null);

check("a malformed key is rejected", weekFromKey("nonsense") === null);
check("an empty key is rejected", weekFromKey("") === null);
check("an impossible date is rejected", weekFromKey("2026-02-31") === null);

// A date that is not a Friday cannot be the start of a report week. Snapping
// it would file the report against a week nobody asked for.
check("a Monday is refused, not snapped", weekFromKey("2026-09-07") === null);
check("a Thursday is refused", weekFromKey("2026-09-10") === null);

// A new year inside a week: 1 January 2027 is a Friday, so it starts one.
const newYear = weekFromKey("2027-01-01");
check("a week starting on New Year's Day works", newYear?.end === "2027-01-07", newYear?.end);

// And a week that straddles the year end.
const straddle = weekOf(new Date(2026, 11, 29)); // Tue 29 Dec 2026
check("a week can straddle the year end", straddle.start === "2026-12-25", straddle.start);
check("ending in the next year", straddle.end === "2026-12-31", straddle.end);

console.log("\nWhich weeks may be reported on\n");

const weeks = recentWeeks(6, new Date(2026, 8, 8));
check("newest first", weeks[0].start === "2026-09-04", weeks[0].start);
check("then the week before", weeks[1].start === "2026-08-28", weeks[1].start);
check("exactly seven days apart", weeks.length === 6);
check("no duplicates", new Set(weeks.map((entry) => entry.key)).size === 6);
check("every one starts on a Friday", weeks.every((entry) => dayName(entry.start) === "Fri"));

const now = new Date(2026, 8, 8);
check("the current week is reportable", isReportable(weekOf(now), now));
check("a past week is reportable", isReportable(weekOf(new Date(2026, 7, 20)), now));

// A report filed in advance is a guess with two signatures on it.
check("next week is not", !isReportable(weekOf(new Date(2026, 8, 15)), now));
check("nothing is not", !isReportable(null));

console.log("\nWhich weeks anyone is chased for\n");

check("the start week is a Friday", dayName(START_WEEK) === "Fri", START_WEEK);
check("the current week is chased", isChased(weekOf(now), now));

// Weeks before the module existed were filed on paper.
const march = weekOf(new Date(2026, 2, 10));
check("a week from before the module is not chased", !isChased(march, now));
check("although it can still be filled in", isReportable(march, now));
check("a future week is not chased", !isChased(weekOf(new Date(2026, 8, 15)), now));
check("nothing is not chased", !isChased(null, now));

console.log("\nWhat the form offers\n");

check("four daily criteria, as on the paper", DAILY_CRITERIA.length === 4);
check(
  "only the lecture reports are answered by the system",
  DAILY_CRITERIA.filter((item) => item.auto).length === 1 &&
    DAILY_CRITERIA.find((item) => item.auto).key === "lecture_reports"
);

// One scale for both graded questions, so they can be compared across trainers
// and weeks. Trainees' feedback used to be Yes/No, which recorded only whether
// the exercise happened and not what it said.
check("four grades", QUALITY_GRADES.length === 4);
check("best first", QUALITY_GRADES[0] === "Excellent" && QUALITY_GRADES[3] === "Poor");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
