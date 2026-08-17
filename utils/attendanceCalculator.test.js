/**
 * Regression tests for the attendance percentage rules.
 *
 * Run with:  node utils/attendanceCalculator.test.js
 * Exits non-zero if any rule regresses. No test framework required.
 *
 * The rules under test (agreed with the program team):
 *   1. Counting starts at the student's FIRST marked attendance for the class.
 *   2. Approved leave ("L") counts as present.
 *   3. A day the class ran but this student was never marked is skipped, not
 *      counted as absent, and reported as `unmarkedDays`.
 *   4. Future-dated and invalid rows are ignored.
 *   5. Duplicate rows for one student/date resolve to the highest attend_id.
 */
const path = require("path");
const fs = require("fs");

// Load the module without requiring a database connection.
const source = fs
  .readFileSync(path.join(__dirname, "attendanceCalculator.js"), "utf8")
  .replace('const Attendance = require("../models/attendanceModel");', "const Attendance = null;");
const sandbox = { exports: {} };
new Function("module", "exports", "require", source)(sandbox, sandbox.exports, require);
const { dedupeByStudentAndDate, buildStats } = sandbox.exports;

const classDatesFrom = (byStudent) =>
  [...new Set([...byStudent.values()].flatMap((dates) => [...dates.keys()]))].sort();

let passed = 0;
let failed = 0;

const check = (label, records, cnic, expected) => {
  const byStudent = dedupeByStudentAndDate(records);
  const stats = buildStats(byStudent.get(cnic), classDatesFrom(byStudent));
  const actual = `${stats.percentage}% denom=${stats.daysCounted} unmarked=${stats.unmarkedDays} first=${stats.firstMarkedDate}`;
  if (actual === expected) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}\n        expected: ${expected}\n        actual:   ${actual}`);
  }
};

// Dates must be in the past, since future-dated rows are deliberately ignored.
const daysAgo = (n) => {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
};
const [D1, D2, D3, D4, D5] = [9, 8, 7, 6, 5].map(daysAgo);

let sequence = 0;
const row = (cnic, date, status) => ({
  attend_id: (sequence += 1),
  std_cnic: cnic,
  attend_date: date,
  attend_status: status,
});

console.log("Attendance calculator rules:");

check(
  "P,P,L,A over 4 marked days -> 75% (leave counts as present)",
  [row("A", D1, "P"), row("A", D2, "P"), row("A", D3, "L"), row("A", D4, "A")],
  "A",
  `75% denom=4 unmarked=0 first=${D1}`
);

check(
  "class ran 4 days, student marked on 3 -> denominator 3, 1 flagged",
  [
    row("A", D1, "P"), row("A", D2, "P"), row("A", D4, "P"),
    row("B", D1, "P"), row("B", D2, "P"), row("B", D3, "P"), row("B", D4, "P"),
  ],
  "A",
  `100% denom=3 unmarked=1 first=${D1}`
);

check(
  "late joiner is not judged on class days before their first mark",
  [
    row("B", D1, "P"), row("B", D2, "P"), row("B", D4, "P"), row("B", D5, "P"),
    row("A", D4, "P"), row("A", D5, "A"),
  ],
  "A",
  `50% denom=2 unmarked=0 first=${D4}`
);

check(
  "duplicate rows for one date resolve to the highest attend_id (A corrected to P)",
  [row("A", D1, "A"), row("A", D1, "P"), row("A", D2, "P")],
  "A",
  `100% denom=2 unmarked=0 first=${D1}`
);

check(
  "'Not Set' and future-dated rows are ignored",
  [row("A", D1, "P"), row("A", D2, "Not Set"), row("A", "2099-01-01", "A")],
  "A",
  `100% denom=1 unmarked=0 first=${D1}`
);

check("student with no records -> 0%, no divide-by-zero", [row("B", D1, "P")], "A", "0% denom=0 unmarked=0 first=null");

check("all absent -> 0%", [row("A", D1, "A"), row("A", D2, "A")], "A", `0% denom=2 unmarked=0 first=${D1}`);

check(
  "lower-case statuses are normalised",
  [row("A", D1, "p"), row("A", D2, "l")],
  "A",
  `100% denom=2 unmarked=0 first=${D1}`
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
