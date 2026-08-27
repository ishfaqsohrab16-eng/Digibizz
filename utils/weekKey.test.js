/**
 * Regression tests for the ISO week helpers.
 *
 * Run with:  node utils/weekKey.test.js
 * Exits non-zero if any rule regresses. No test framework required.
 *
 * These decide whether a student may submit feedback, so the edges matter:
 * Sunday belongs to the week that STARTED on the previous Monday, and the
 * new-year boundary must not split one week across two keys.
 */
const {
  startOfIsoWeek,
  endOfIsoWeek,
  isoWeekKey,
  localDateKey,
  monthKey,
} = require("./weekKey");

let passed = 0;
let failed = 0;

const check = (label, actual, expected) => {
  if (String(actual) === String(expected)) {
    passed += 1;
    console.log(`  PASS  ${label}  ->  ${actual}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}\n        expected: ${expected}\n        actual:   ${actual}`);
  }
};

// Local-time constructor, matching how the helpers read dates.
const d = (y, m, day) => new Date(y, m - 1, day);

console.log("\nISO week helpers\n");

// Week of Mon 17 Aug 2026 .. Sun 23 Aug 2026.
check("Monday starts its own week", localDateKey(startOfIsoWeek(d(2026, 8, 17))), "2026-08-17");
check("Wednesday maps back to Monday", localDateKey(startOfIsoWeek(d(2026, 8, 19))), "2026-08-17");
check(
  "Sunday belongs to the week that started Monday, not the next one",
  localDateKey(startOfIsoWeek(d(2026, 8, 23))),
  "2026-08-17"
);
check("the next Monday starts a NEW week", localDateKey(startOfIsoWeek(d(2026, 8, 24))), "2026-08-24");
check("week ends on Sunday", localDateKey(endOfIsoWeek(d(2026, 8, 19))), "2026-08-23");

// Every day of one week must produce the same key - that IS the "any day of
// that week" rule.
const week = [17, 18, 19, 20, 21, 22, 23].map((day) => isoWeekKey(d(2026, 8, day)));
check("all seven days share one key", new Set(week).size, 1);
check("Monday and the following Sunday differ", isoWeekKey(d(2026, 8, 23)) === isoWeekKey(d(2026, 8, 24)), "false");

// New-year boundary: 1 Jan 2027 is a Friday, so it falls in the ISO week that
// began Mon 28 Dec 2026 - and must carry the 2026 week-numbering year.
check("31 Dec 2026 and 1 Jan 2027 share a week", isoWeekKey(d(2026, 12, 31)), isoWeekKey(d(2027, 1, 1)));
check("that shared week uses the ISO year, not the calendar year", isoWeekKey(d(2027, 1, 1)), "2026-W53");

// 4 January is always in week 1 by definition.
check("4 Jan is always week 1", isoWeekKey(d(2027, 1, 4)), "2027-W01");

check("month key is sortable, not a localised name", monthKey(d(2026, 8, 19)), "2026-08");
check("date key is local, not UTC-shifted", localDateKey(d(2026, 1, 1)), "2026-01-01");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
