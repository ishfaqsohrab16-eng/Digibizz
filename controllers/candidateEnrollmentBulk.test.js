/**
 * Regression tests for bulk enrolment from a CNIC list.
 *
 * Run with:  node controllers/candidateEnrollmentBulk.test.js
 * Exits non-zero if any rule regresses. No database.
 *
 * This tool creates real LMS accounts, hundreds at a time, from a spreadsheet
 * typed by hand. What has to hold:
 *
 *   - it never enrols anyone the individual Enroll button would refuse,
 *   - it is scoped to one batch, because the same CNIC can have applied twice,
 *   - and every row of the file is accounted for in the report, including the
 *     ones nothing happened to. A row that silently vanishes is how somebody
 *     ends up not enrolled with nobody noticing.
 */
const stub = (request, exports) => {
  const resolved = require.resolve(request);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports,
  };
};

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

// --- the database -----------------------------------------------------------

const { Op } = require("sequelize");

const db = { candidates: [], students: [], users: [] };

/**
 * Crude stand-in for `WHERE col IN (...)`, `col != x` and plain equality.
 *
 * Sequelize's operators are SYMBOL keys, so Object.values() and
 * Object.entries() do not see them - a first attempt at this read every
 * operator condition as empty and quietly matched nothing, which made the
 * controller look broken when the stub was.
 */
const matches = (row, where) => {
  for (const [key, condition] of Object.entries(where || {})) {
    if (condition && typeof condition === "object") {
      if (Op.in in condition) {
        const values = condition[Op.in].map(String);
        if (!values.includes(String(row[key]))) return false;
      } else if (Op.ne in condition) {
        if (String(row[key]) === String(condition[Op.ne])) return false;
      } else {
        throw new Error(`test stub does not handle ${String(Object.getOwnPropertySymbols(condition))}`);
      }
    } else if (String(row[key]) !== String(condition)) {
      return false;
    }
  }
  return true;
};

stub("../models/CandidateModel", {
  async findAll({ where }) {
    return db.candidates.filter((row) => matches(row, where));
  },
  async findByPk(id) {
    return db.candidates.find((row) => String(row.cand_id) === String(id)) || null;
  },
});

stub("../models/studentModel", {
  async findOne({ where }) {
    return db.students.find((row) => matches(row, where)) || null;
  },
});

stub("../models/userModel", {
  async findOne({ where }) {
    return db.users.find((row) => matches(row, where)) || null;
  },
});

stub("../models/center", { async findByPk() { return null; } });
stub("../models/course", { async findByPk() { return null; } });
stub("../models/trainingBatcheModel", {});
stub("../config/db", { sequelize: { transaction: async () => ({}) } });
stub("../servec/emailConfig", {
  sendEmailSafe: () => Promise.resolve(true),
  escapeHtml: (v) => String(v),
});
stub("../servec/emailTemplates", {
  enrolmentConfirmed: () => ({ subject: "s", text: "t", html: "<p>h</p>" }),
});

/**
 * The class schedule the enrolment email quotes.
 *
 * Present by default: these tests are about who may be enrolled, and every
 * one of them would otherwise trip the missing-schedule blocker instead of
 * the rule it is checking. The blocker has its own tests below.
 */
const schedules = { present: true };
stub("./classScheduleController", {
  async findScheduleFor() {
    return schedules.present
      ? {
          cs_start_date: "2026-09-15",
          cs_class_days: "Monday to Friday",
          cs_start_time: "09:00 AM",
          cs_end_time: "01:00 PM",
        }
      : null;
  },
});

const { _internals } = require("./candidateEnrollmentController");
const { findBlocker, planBulkEnrollment, summarise } = _internals;

const entry = (cnic, line) => ({
  cnic,
  formatted: cnic,
  raw: cnic,
  line,
});

(async () => {
  console.log("\nWho may be enrolled\n");

  const good = {
    cand_id: 1,
    cand_cnic: "3520212345671",
    cand_email: "ali@example.com",
    recommended: "Yes",
    tb_id: 10,
  };

  db.students = [];
  db.users = [];
  check("a recommended candidate has no blocker", (await findBlocker(good)) === null);

  // The single Enroll button acts on a table row, where the recommendation is
  // the only evidence the panel decided anything - so it stays enforced there.
  check(
    "an un-recommended candidate is refused by the single-enrolment default",
    (await findBlocker({ ...good, recommended: "No" }))?.status === "not_recommended"
  );
  // The interview panel writes "Yes"; anything else means the panel has not
  // said yes, and enrolling on a blank is how someone gets in by accident.
  check(
    "a blank recommendation is refused, not treated as consent",
    (await findBlocker({ ...good, recommended: "" }))?.status === "not_recommended"
  );

  db.students = [{ std_cnic: "3520212345671", tb_id: 10, std_rollno: "DB10-1234567-8" }];
  const enrolled = await findBlocker(good);
  check("an already-enrolled candidate is refused", enrolled?.status === "already_enrolled");
  check(
    "and the message carries the roll number they already have",
    /DB10-1234567-8/.test(enrolled?.message || ""),
    enrolled?.message
  );

  // Enrolment in a DIFFERENT batch is not a blocker: the same person can be a
  // student in batch 9 and a fresh candidate in batch 10.
  db.students = [{ std_cnic: "3520212345671", tb_id: 9, std_rollno: "DB9-1111111-1" }];
  check(
    "enrolment in another batch does not block this one",
    (await findBlocker(good)) === null
  );

  check(
    "but bulk asks it not to, and gets no blocker",
    (await findBlocker({ ...good, recommended: "No" }, undefined, {
      requireRecommendation: false,
    })) === null
  );

  db.students = [];
  check(
    "a candidate with no email is refused",
    (await findBlocker({ ...good, cand_email: "" }))?.status === "no_email"
  );

  db.users = [{ user_email: "ali@example.com", user_id: 5 }];
  check(
    "an email already in use is refused",
    (await findBlocker(good))?.status === "email_taken"
  );

  // The enrolment email quotes the class start date and timings. Telling
  // somebody to arrive on a blank date is worse than sending nothing.
  db.users = [];
  schedules.present = false;
  const noSchedule = await findBlocker(good);
  check(
    "a class with no start date and timings cannot be enrolled into",
    noSchedule?.status === "no_schedule",
    JSON.stringify(noSchedule)
  );
  check(
    "and the message says where to set them",
    /Class Schedule/.test(noSchedule?.message || ""),
    noSchedule?.message
  );
  schedules.present = true;

  console.log("\nPlanning an upload\n");

  db.students = [];
  db.users = [];
  db.candidates = [
    { cand_id: 1, cand_cnic: "3520212345671", cand_name: "Ali", cand_email: "ali@x.com", recommended: "Yes", tb_id: 10 },
    // Stored WITH dashes, as older imported rows are.
    { cand_id: 2, cand_cnic: "42101-7654321-9", cand_name: "Sana", cand_email: "sana@x.com", recommended: "Yes", tb_id: 10 },
    { cand_id: 3, cand_cnic: "6110123456783", cand_name: "Bilal", cand_email: "b@x.com", recommended: "No", tb_id: 10 },
    // Same person, previous batch.
    { cand_id: 4, cand_cnic: "9999999999999", cand_name: "Old", cand_email: "o@x.com", recommended: "Yes", tb_id: 9 },
  ];

  const plan = await planBulkEnrollment(
    [
      entry("3520212345671", 2),
      entry("4210176543219", 3),
      entry("6110123456783", 4),
      entry("9999999999999", 5),
      entry("1111111111111", 6),
    ],
    10
  );

  check("every row is accounted for", plan.length === 5, String(plan.length));
  check("a recommended candidate is ready", plan[0].status === "ready");
  check("the candidate's name comes from the database, not the file", plan[0].name === "Ali");

  // Registration strips dashes, older imports did not. Matching only the bare
  // digits would report a candidate who is plainly there as "not found".
  check(
    "a CNIC stored with dashes still matches",
    plan[1].status === "ready" && plan[1].name === "Sana",
    JSON.stringify(plan[1])
  );

  // The uploaded list IS the panel's decision. Refusing a name on it because
  // the interview screen was never updated would be the tool arguing with the
  // people using it.
  check("an un-recommended candidate is enrolled anyway", plan[2].status === "ready");
  check(
    "but is flagged, so the operator can spot a mistyped CNIC",
    plan[2].unrecommended === true,
    JSON.stringify(plan[2])
  );
  check(
    "and the row says so in plain words",
    /not marked recommended/.test(plan[2].message),
    plan[2].message
  );
  check(
    "a recommended candidate carries no such flag",
    plan[0].unrecommended === false,
    JSON.stringify(plan[0])
  );

  // Scoped to the batch: the batch-9 record must not be enrolled into batch 10.
  check("a candidate from another batch is not enrolled", plan[3].status === "not_found");
  check(
    "and the message says where they actually are, rather than just 'not found'",
    /batch 9/.test(plan[3].message),
    plan[3].message
  );

  check("an unknown CNIC is reported as not found", plan[4].status === "not_found");
  check(
    "with no misleading hint about other batches",
    !/batch/.test(plan[4].message),
    plan[4].message
  );

  console.log("\nThe summary the operator reads\n");

  const summary = summarise(plan, [{ line: 7, raw: "abc", reason: "bad" }]);
  check("ready is counted", summary.ready === 3, String(summary.ready));
  check(
    "bulk never refuses for a missing recommendation",
    summary.not_recommended === 0,
    String(summary.not_recommended)
  );
  check(
    "those enrolled without one are counted so the number is visible",
    summary.unrecommended_included === 1,
    String(summary.unrecommended_included)
  );
  check("not_found is counted", summary.not_found === 2, String(summary.not_found));
  check("unreadable rows are counted separately", summary.unreadable === 1);
  check(
    "every classified row is in exactly one bucket",
    // unrecommended_included is deliberately NOT in this sum: those rows are
    // already counted in `ready`, and adding them would double-count.
    summary.ready +
      summary.not_recommended +
      summary.not_found +
      summary.already_enrolled +
      summary.no_email +
      summary.email_taken +
      summary.no_schedule ===
      plan.length,
    JSON.stringify(summary)
  );

  console.log("\nAn empty file\n");

  const empty = await planBulkEnrollment([], 10);
  check("plans nothing and does not query", empty.length === 0);
  check("and summarises to zero ready", summarise(empty, []).ready === 0);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((error) => {
  console.error("test run failed:", error);
  process.exit(1);
});
