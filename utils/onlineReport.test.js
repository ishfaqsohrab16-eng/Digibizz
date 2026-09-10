/**
 * Tests for the Online Classes Report, and for keeping online centres out of
 * the per-trainer M&E report.
 *
 * Run with:  node utils/onlineReport.test.js
 * Exits non-zero if any rule regresses. No database - the centre model is a
 * stub that honours `center_id IN (...)`.
 */

const { Op } = require("sequelize");

const stub = (request, exports) => {
  const resolved = require.resolve(request);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};

let centers = [];
stub("../models/trainersCenterAllocationModel", {});
stub("../models/centersDatesModel", {});
stub("../models/center", {
  findAll: async ({ where }) => {
    const ids = (where?.center_id?.[Op.in] || []).map(Number);
    return centers.filter((center) => ids.includes(Number(center.center_id)));
  },
});

const { physicalOnly } = require("./evaluationScope");
const { isOnlineMedium } = require("./centerMedium");
const { ONLINE_QUESTIONS, TEXT_LIMIT, cleanAnswers, unanswered } = require("./onlineReportForm");

let passed = 0;
let failed = 0;

const check = (name, condition, detail) => {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail !== undefined ? `  ->  ${JSON.stringify(detail)}` : ""}`);
  }
};

const main = async () => {
  console.log("\nWhich centres are online\n");

  check("Online is online", isOnlineMedium("Online"));
  check("Hybrid is online", isOnlineMedium("Hybrid"));
  check("regardless of case and padding", isOnlineMedium("  hybrid "));
  check("Physical is not", !isOnlineMedium("Physical"));
  // center_medium defaults to Physical; a centre never classified is a building.
  check("a blank is not", !isOnlineMedium(""));
  check("nor is a missing value", !isOnlineMedium(undefined));

  console.log("\nKeeping online centres out of the trainer report\n");

  centers = [
    { center_id: 1, center_medium: "Physical" },
    { center_id: 2, center_medium: "Online" },
    { center_id: 3, center_medium: "Hybrid" },
  ];

  const kept = await physicalOnly([
    { center_id: 1, t_id: 10 },
    { center_id: 2, t_id: 10 },
    { center_id: 3, t_id: 11 },
    { center_id: 4, t_id: 12 },
  ]);
  const keptIds = kept.map((row) => row.center_id);

  check("a physical centre stays", keptIds.includes(1), keptIds);
  check("an online centre goes", !keptIds.includes(2), keptIds);
  check("a hybrid centre goes", !keptIds.includes(3), keptIds);
  // Dropping a real class over a missing row is the worse mistake.
  check("a centre that cannot be found stays", keptIds.includes(4), keptIds);
  check(
    "a trainer teaching both is kept for the physical class alone",
    kept.filter((row) => row.t_id === 10).length === 1
  );

  centers = [{ center_id: 7, center_medium: "Online" }];
  check(
    "a trainer teaching only online is owed no trainer report",
    (await physicalOnly([{ center_id: 7, t_id: 20 }])).length === 0
  );
  check("nothing in, nothing out", (await physicalOnly([])).length === 0);
  check("and null is handled", (await physicalOnly(null)).length === 0);

  console.log("\nThe form\n");

  check("four questions, as on the paper", ONLINE_QUESTIONS.length === 4);
  check(
    "the last is a yes or a no",
    ONLINE_QUESTIONS[3].key === "mt_took_class" && ONLINE_QUESTIONS[3].kind === "yesno"
  );

  const cleaned = cleanAnswers({
    students_attendance: "  Lab attendant marks the attendance  ",
    trainers_attendance: "",
    lab_feedback: "x".repeat(TEXT_LIMIT + 50),
    mt_took_class: "yes",
    invented: "should not survive",
  });

  check(
    "text is trimmed",
    cleaned.students_attendance === "Lab attendant marks the attendance",
    cleaned.students_attendance
  );
  check("an empty answer is null, not an empty string", cleaned.trainers_attendance === null);
  check("a long answer is capped", cleaned.lab_feedback.length === TEXT_LIMIT);
  check("'yes' is stored as Yes", cleaned.mt_took_class === "Yes");
  check("a key the form never asked is dropped", !("invented" in cleaned));

  check("No is an answer", cleanAnswers({ mt_took_class: "No" }).mt_took_class === "No");
  check("false is No", cleanAnswers({ mt_took_class: false }).mt_took_class === "No");
  check("anything else is unanswered", cleanAnswers({ mt_took_class: "maybe" }).mt_took_class === null);
  check("garbage in is four nulls out", Object.values(cleanAnswers("nonsense")).every((v) => v === null));

  console.log("\nWhat submitting needs\n");

  check("an empty form is missing all four", unanswered(cleanAnswers({})).length === 4);
  check(
    "they are named by their labels",
    unanswered(cleanAnswers({})).includes("MT took class in this week")
  );

  const complete = cleanAnswers({
    students_attendance: "Lab attendant marks the attendance",
    trainers_attendance: "Trainer is regularly taking classes",
    lab_feedback: "Lab attendants join the class on time",
    mt_took_class: "No",
  });
  // "No, the MT did not take a class" is an answer, not a gap.
  check("a complete form, even with a No, is missing nothing", unanswered(complete).length === 0);
};

main().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
});
