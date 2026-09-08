/**
 * Tests for the figures the LMS fills into a weekly M&E report.
 *
 * Run with:  node utils/evaluationMetrics.test.js
 * Exits non-zero if any rule regresses. No database.
 *
 * These numbers are printed on a signed document. The cases here are the ones
 * where a plausible query returns a real number that is about the wrong people
 * or the wrong days - the kind of wrong nobody catches by looking at it.
 */
process.env.TZ = "Asia/Karachi";

const { Op } = require("sequelize");

const stub = (request, exports) => {
  const resolved = require.resolve(request);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};

// The module pulls in the model layer, which wants a database at require time.
stub("../config/db", { sequelize: { query: async () => [[{ total: 0 }]] } });
stub("../models/trainersCenterAllocationModel", {});
stub("../models/dailyLectureReport", {});
stub("../models/assignmentModel", {});
stub("../models/StudentQuiz", {});
stub("../models/studentModel", {});
stub("../models/studentLeaveModel", {});

const { classScope, _internals } = require("./evaluationMetrics");
const { nextDay } = _internals;

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

console.log("\nWhose students get counted\n");

// The trap. A trainer teaching Graphic Design at BUITEMS and Digital Marketing
// at UoB does NOT teach Digital Marketing at BUITEMS. Three IN lists would
// match the cross product and quietly count a colleague's class as theirs -
// and the total would look entirely reasonable.
const twoClasses = [
  { center_id: 1, course_id: 3, tb_id: 10 },
  { center_id: 2, course_id: 4, tb_id: 10 },
];

const scope = classScope(twoClasses);
const clauses = scope[Op.or];

check("an OR of whole classes, not three separate lists", Array.isArray(clauses));
check("one clause per class", clauses.length === 2, String(clauses?.length));
check(
  "each clause pins centre, course AND batch together",
  clauses.every(
    (clause) =>
      clause.center_id !== undefined &&
      clause.course_id !== undefined &&
      clause.tb_id !== undefined
  )
);
check(
  "the first class is exactly the first allocation",
  clauses[0].center_id === 1 && clauses[0].course_id === 3 && clauses[0].tb_id === 10
);
check(
  "and no clause mixes one centre with the other's course",
  !clauses.some((clause) => clause.center_id === 1 && clause.course_id === 4)
);

// A trainer with no allocation has no students. Returning {} here would be an
// unscoped WHERE - every student in the programme counted as theirs.
check("no classes means no scope, not an empty filter", classScope([]) === null);

console.log("\nThe end of the week\n");

// Friday's rows have to be inside the week. An inclusive BETWEEN on a DATETIME
// column stops at midnight and silently drops everything that happened during
// Friday itself, so the upper bound is the start of Saturday.
check("the day after Friday is Saturday", nextDay("2026-09-11") === "2026-09-12 00:00:00");
check("month ends roll over", nextDay("2026-09-30") === "2026-10-01 00:00:00");
check("year ends roll over", nextDay("2026-12-31") === "2027-01-01 00:00:00");

// February in a leap year, which is where naive date arithmetic goes wrong.
check("a leap day is a real day", nextDay("2028-02-28") === "2028-02-29 00:00:00");
check("and the day after it", nextDay("2028-02-29") === "2028-03-01 00:00:00");
check("a non-leap February ends on the 28th", nextDay("2026-02-28") === "2026-03-01 00:00:00");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
