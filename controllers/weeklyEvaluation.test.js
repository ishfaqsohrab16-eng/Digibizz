/**
 * Tests for what a weekly M&E report accepts from a browser.
 *
 * Run with:  node controllers/weeklyEvaluation.test.js
 * Exits non-zero if any rule regresses. No database.
 *
 * Every field here ends up on a document two people sign. The cases that
 * matter are the ones where a form post produces a report that looks filled in
 * and is not - a blank that renders as a tick, a count that renders as NaN, a
 * week that quietly becomes this week.
 */
process.env.TZ = "Asia/Karachi";

const stub = (request, exports) => {
  const resolved = require.resolve(request);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};

// The controller pulls in the whole model layer, which wants a database
// connection at require time. None of that is exercised here.
stub("../models/weeklyEvaluationModel", {});
stub("../models/trainersModel", {});
stub("../models/masterTrainersModel", {});
stub("../models/userModel", {});
stub("../models/center", {});
stub("../models/course", {});
stub("../models/trainingBatcheModel", {});
stub("../models/trainersCenterAllocationModel", {});
stub("../utils/evaluationMetrics", { metricsFor: async () => ({}), classesFor: async () => [] });

const { _internals } = require("./weeklyEvaluationController");
const { cleanDaily, countFrom, textFrom, resolveWeek } = _internals;
const { weekOf } = require("../utils/evaluationWeek");

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

const week = weekOf(new Date(2026, 8, 8));

console.log("\nThe day grid\n");

const daily = cleanDaily(
  {
    lecture_reports: { mon: true, tue: false, wed: "true" },
    course_mapping: { mon: true },
    // A criterion the form does not define, from an old tab or a hand-written
    // request. It must not be stored.
    invented: { mon: true },
  },
  week,
  null
);

check("the four criteria are kept", Object.keys(daily).length === 4, Object.keys(daily).join(","));
check("an invented criterion is dropped", daily.invented === undefined);
check("a tick is a tick", daily.lecture_reports.mon === true);
check('the string "true" counts too', daily.lecture_reports.wed === true);

// An unticked box is an answer of "no", not an absence. Left undefined it
// renders as an empty cell, which reads as neither answer on a signed form.
check("an unticked box is false, not missing", daily.lecture_reports.tue === false);
check("a day never mentioned is false", daily.lecture_reports.thu === false);
check("every day is present", Object.keys(daily.course_mapping).sort().join(",") === "fri,mon,thu,tue,wed");

// A day that is not one of the five must not be stored: it would be written to
// a report that has no column to show it in.
const strayDay = cleanDaily({ course_mapping: { sat: true, mon: true } }, week, null);
check("a day outside the week is dropped", strayDay.course_mapping.sat === undefined);
check("and the real ones survive", strayDay.course_mapping.mon === true);

// The blank fifth row on the paper form is only stored when it is named.
const noCustom = cleanDaily({ custom: { mon: true } }, week, null);
check("an unnamed custom row is dropped", noCustom.custom === undefined);

const withCustom = cleanDaily({ custom: { mon: true } }, week, "Punctuality of students");
check("a named custom row is kept", withCustom.custom?.mon === true);

check("no grid at all is still five days of false", cleanDaily(undefined, week, null).course_mapping.mon === false);
check("null is handled", cleanDaily(null, week, null).presence.fri === false);

console.log("\nThe counts\n");

check("a number is a number", countFrom("12") === 12);
check("zero is a real answer, not a blank", countFrom(0) === 0);
check("zero as a string too", countFrom("0") === 0);

// Blank means "not answered". Coerced to 0 it would report no drop-outs when
// nobody had counted them, which is a different and worse claim.
check("blank is unanswered, not zero", countFrom("") === null);
check("null is unanswered", countFrom(null) === null);
check("undefined is unanswered", countFrom(undefined) === null);

// NaN reaching the column shows as an empty cell on the report and breaks any
// total computed across weeks.
check("text is not a count", countFrom("many") === null);
check("a negative count is refused", countFrom(-3) === null);
check("a decimal is floored, not stored as 12.7", countFrom("12.7") === 12);

console.log("\nThe free text\n");

check("text is trimmed", textFrom("  remarks  ", 100) === "remarks");
check("empty is null, not an empty string", textFrom("   ", 100) === null);
check("nothing is null", textFrom(undefined, 100) === null);

// The column has a width. Truncating here is what stops a long remark being
// rejected by the database and losing the whole report - the failure that
// already cost a trainer their daily lecture report once.
const long = textFrom("x".repeat(5000), 4000);
check("a long remark is cut to fit its column", long.length === 4000, String(long.length));

console.log("\nWhich week a report is filed against\n");

const current = resolveWeek(undefined);
check("no week given means this week", current.week?.key === weekOf().key);

const named = resolveWeek(week.key);
check("a named past week is accepted", named.week?.start === "2026-09-07", named.week?.start);

// A bad key must be refused rather than silently treated as this week. A
// report filed against the wrong week is worse than an error, because nobody
// notices until the month is reviewed.
check("a malformed week is refused", Boolean(resolveWeek("last-tuesday").error));
check("and says so", /not a week/.test(resolveWeek("nonsense").error || ""));
check("week 99 is refused", Boolean(resolveWeek("2026-W99").error));

// A report filed in advance is a guess with two signatures on it.
const future = weekOf(new Date(Date.now() + 21 * 24 * 60 * 60 * 1000));
check("a future week is refused", Boolean(resolveWeek(future.key).error));
check("and says why", /has not happened/.test(resolveWeek(future.key).error || ""));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
