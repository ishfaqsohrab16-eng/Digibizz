/**
 * Regression tests for the assignment rules.
 *
 * Run with:  node utils/assignmentRules.test.js
 * Exits non-zero if any rule regresses. No database.
 *
 * Each of these encodes a bug the module actually had: marks that were never
 * checked against the total, an average that quietly dropped every zero, a
 * pending count that went negative, and a deadline the server never looked at.
 */
const {
  isPastDeadline,
  minutesUntilDeadline,
  validateMark,
  averageMark,
  submissionStatistics,
  STATUS_SUBMITTED,
  STATUS_MARKED,
} = require("./assignmentRules");

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

const now = new Date("2026-09-01T12:00:00Z");

console.log("\nDeadlines\n");

check("an hour ago is past", isPastDeadline("2026-09-01T11:00:00Z", now));
check("an hour ahead is not", !isPastDeadline("2026-09-01T13:00:00Z", now));

// The column is a plain string, so it can hold anything. Refusing a student's
// work because somebody typed the date wrong would punish the wrong person.
check("an unreadable deadline is NOT treated as past", !isPastDeadline("next Tuesday", now));
check("an empty deadline is not past", !isPastDeadline("", now));
check("a null deadline is not past", !isPastDeadline(null, now));

check(
  "minutes remaining counts down",
  minutesUntilDeadline("2026-09-01T13:30:00Z", now) === 90,
  String(minutesUntilDeadline("2026-09-01T13:30:00Z", now))
);
check(
  "and goes negative once passed",
  minutesUntilDeadline("2026-09-01T11:30:00Z", now) === -30
);
check("unreadable gives null, not NaN", minutesUntilDeadline("soon", now) === null);

console.log("\nMarks\n");

check("a mark inside the total is fine", validateMark("8", 10) === null);
check("the total itself is fine", validateMark("10", 10) === null);
check("zero is a valid mark", validateMark("0", 10) === null);
check("a decimal is fine", validateMark("7.5", 10) === null);
// Clearing a mark has to be possible - a trainer who marked the wrong row
// needs a way back.
check("an empty value clears the mark", validateMark("", 10) === null);

// The column is STRING(5), so this stored happily and turned every average
// built from it into NaN.
check("text is refused", /number/.test(validateMark("abc", 10) || ""));
check("negative is refused", /negative/.test(validateMark("-1", 10) || ""));
check(
  "more than the total is refused",
  /more than/.test(validateMark("11", 10) || ""),
  validateMark("11", 10)
);
check(
  "and the message says what the total is",
  /10/.test(validateMark("11", 10) || "")
);
// STRING(5): "1000.25" would be silently truncated to "1000." on the way in.
check(
  "something too long for the column is refused",
  /5 characters/.test(validateMark("1000.25", 10000) || "")
);

console.log("\nThe class average\n");

const marked = (obt) => ({ obt_marks: obt, as_submission_status: STATUS_MARKED });

check("nothing marked gives null, not zero", averageMark([]) === null);
check(
  "unmarked submissions are not averaged",
  averageMark([{ obt_marks: null, as_submission_status: STATUS_SUBMITTED }]) === null
);
check("a single mark averages to itself", averageMark([marked("7")]) === 7);
check("two marks average", averageMark([marked("6"), marked("8")]) === 7);

// The bug: `sub.obt_marks && parseFloat(sub.obt_marks) > 0` dropped every
// student who scored nothing, which flattered every class it was shown for.
check(
  "a zero counts - it is a mark, not a missing one",
  averageMark([marked("0"), marked("10")]) === 5,
  String(averageMark([marked("0"), marked("10")]))
);
check(
  "text among the marks does not poison the average",
  averageMark([marked("abc"), marked("6")]) === 6,
  String(averageMark([marked("abc"), marked("6")]))
);

console.log("\nWhat the trainer sees\n");

const stats = submissionStatistics(
  [marked("8"), { obt_marks: null, as_submission_status: STATUS_SUBMITTED }],
  5
);
check("submissions are counted", stats.submissionCount === 2);
check("marked ones are counted separately", stats.markedCount === 1);
check("so is the marking still to do", stats.awaitingMarking === 1);
check("pending is the rest of the class", stats.pendingCount === 3);
check("the average uses only marked work", stats.avgMarks === 8);

// It was `totalStudents - submissionCount`, which goes negative the moment
// somebody submits and then leaves the batch.
const moved = submissionStatistics([marked("5"), marked("6"), marked("7")], 2);
check(
  "pending never goes negative when a student has left",
  moved.pendingCount === 0,
  String(moved.pendingCount)
);

const empty = submissionStatistics([], 0);
check("an empty class does not divide by zero", empty.avgMarks === null);
check("and reports nothing pending", empty.pendingCount === 0);
check(
  "a missing class size is treated as zero, not NaN",
  submissionStatistics([], undefined).totalStudents === 0
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
