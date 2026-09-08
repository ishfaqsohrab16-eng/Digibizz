/**
 * Tests for the week a weekly M&E report covers.
 *
 * Run with:  node utils/evaluationWeek.test.js
 * Exits non-zero if any rule regresses.
 *
 * The week boundary decides every automatic figure on a signed report - how
 * many assignments were set, how many students were enrolled at the start, who
 * was on leave. An off-by-one here is not a display bug; it is a wrong number
 * on a document two people put their names to.
 */
process.env.TZ = "Asia/Karachi";

const {
  weekOf,
  weekFromKey,
  recentWeeks,
  isReportable,
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

console.log("\nMonday to Friday\n");

// Tuesday 8 September 2026.
let week = weekOf(new Date(2026, 8, 8));
check("the week starts on Monday", week.start === "2026-09-07", week.start);
check("and ends on Friday", week.end === "2026-09-11", week.end);
check("five teaching days", week.days.length === 5);

// The whole point of the boundary: every day of the week has to resolve to the
// same week, or a Friday report and a Monday report disagree about which week
// they belong to.
for (const [day, label] of [
  [7, "Monday"],
  [8, "Tuesday"],
  [9, "Wednesday"],
  [10, "Thursday"],
  [11, "Friday"],
  [12, "Saturday"],
  [13, "Sunday"],
]) {
  const from = weekOf(new Date(2026, 8, day));
  check(`${label} resolves to the same week`, from.start === "2026-09-07", from.start);
}

// Sunday is the END of an ISO week, which is the classic off-by-one: read as
// the start of the next one, a Sunday submission files against the wrong week.
const sunday = weekOf(new Date(2026, 8, 6));
check("the Sunday before belongs to the PREVIOUS week", sunday.start === "2026-08-31", sunday.start);

console.log("\nThe columns the paper form prints\n");

// The form heads its columns "Fri Mon Tue Wed Thurs". The screen keeps that
// order so it matches the paper in front of the person filling it in.
check(
  "columns are in the paper's order",
  week.days.map((day) => day.label).join(" ") === "Fri Mon Tue Wed Thurs",
  week.days.map((day) => day.label).join(" ")
);

// But each column has to carry its REAL date, or Friday-first is unreadable.
const byKey = Object.fromEntries(week.days.map((day) => [day.key, day.date]));
check("Monday's column is Monday's date", byKey.mon === "2026-09-07");
check("Tuesday's", byKey.tue === "2026-09-08");
check("Wednesday's", byKey.wed === "2026-09-09");
check("Thursday's", byKey.thu === "2026-09-10");
check("Friday's is the END of the week, not the start", byKey.fri === "2026-09-11", byKey.fri);

// Display order must not leak into storage. Reordering the columns later would
// otherwise re-map every stored answer to a different day.
check(
  "storage keys are day names, not positions",
  DAYS.every((day) => /^(mon|tue|wed|thu|fri)$/.test(day.key))
);

console.log("\nRebuilding a week from its key\n");

const rebuilt = weekFromKey(week.key);
check("a key round-trips", rebuilt && rebuilt.start === week.start, rebuilt && rebuilt.start);
check("and keeps its dates", rebuilt && rebuilt.end === "2026-09-11");

check("a malformed key is rejected", weekFromKey("nonsense") === null);
check("an empty key is rejected", weekFromKey("") === null);
check("week 0 is rejected", weekFromKey("2026-W00") === null);
check("week 54 is rejected", weekFromKey("2026-W54") === null);

// 1 January is often in the last ISO week of the previous year. A key built
// from the calendar year would name a week that does not exist and rebuild as
// a different one entirely.
const newYear = weekOf(new Date(2027, 0, 1));
check(
  "a new-year week round-trips through its key",
  weekFromKey(newYear.key)?.start === newYear.start,
  `${newYear.key} -> ${weekFromKey(newYear.key)?.start} (want ${newYear.start})`
);

console.log("\nWhich weeks may be reported on\n");

const weeks = recentWeeks(6, new Date(2026, 8, 8));
check("newest first", weeks[0].start === "2026-09-07", weeks[0].start);
check("then the week before", weeks[1].start === "2026-08-31", weeks[1].start);
check("as many as asked for", weeks.length === 6);
check("no duplicates", new Set(weeks.map((entry) => entry.key)).size === 6);

// The current week is reportable: a report is due at the end of it, and an MT
// finishing their Friday visit should not have to wait until Monday.
check("the current week is reportable", isReportable(weekOf(new Date(2026, 8, 8)), new Date(2026, 8, 8)));
check(
  "a past week is reportable",
  isReportable(weekOf(new Date(2026, 7, 25)), new Date(2026, 8, 8))
);

// A future week is not. There is nothing to evaluate yet, and a report filed
// in advance is a guess with two signatures on it.
check(
  "next week is not",
  !isReportable(weekOf(new Date(2026, 8, 15)), new Date(2026, 8, 8))
);
check("nothing is not", !isReportable(null));

console.log("\nWhat the form offers\n");

check("four daily criteria, as on the paper", DAILY_CRITERIA.length === 4);
check(
  "only the lecture reports are answered by the system",
  DAILY_CRITERIA.filter((item) => item.auto).length === 1 &&
    DAILY_CRITERIA.find((item) => item.auto).key === "lecture_reports"
);
check("four quality grades", QUALITY_GRADES.length === 4);
check("best first", QUALITY_GRADES[0] === "Excellent" && QUALITY_GRADES[3] === "Poor");

console.log("\nWhich weeks anyone is chased for\n");

// Weeks before this module took over were filed on paper. Chasing a Master
// Trainer for one is asking them to do the same work twice, and a red
// "missing" count nobody can ever clear is worse than no count at all.
const { isChased, START_WEEK } = require("./evaluationWeek");
const nowish = new Date(2026, 8, 8);

check("the start week is a Monday", new Date(START_WEEK + "T00:00:00").getDay() === 1, START_WEEK);

const thisWeek = weekOf(nowish);
check("the current week is chased", isChased(thisWeek, nowish), thisWeek.start);

// March is long before the module existed.
const march = weekOf(new Date(2026, 2, 10));
check("a week from before the module is not chased", !isChased(march, nowish));

// But it is still perfectly reportable - someone typing up a paper report
// from March must be able to. Reportable and chased are different questions
// and collapsing them would lock the backfill out.
check("although it can still be filled in", isReportable(march, nowish));

// A future week is neither.
const ahead = weekOf(new Date(2026, 8, 15));
check("a future week is not chased", !isChased(ahead, nowish));
check("nor reportable", !isReportable(ahead, nowish));

check("nothing is not chased", !isChased(null, nowish));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
