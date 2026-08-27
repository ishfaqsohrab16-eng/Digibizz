/**
 * Regression tests for the change-log summaries.
 *
 * Run with:  node utils/auditHooks.test.js
 * Exits non-zero if any rule regresses. No test framework required.
 *
 * What matters here is that a reader can answer "who changed what, on which
 * record, from what to what" from the paragraph alone, and that a password
 * never appears in it.
 */
const { buildSummary, describeSubject, diffFields } = require("./auditHooks");

let passed = 0;
let failed = 0;

const check = (label, actual, predicate) => {
  const ok = typeof predicate === "function" ? predicate(actual) : actual === predicate;
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}\n        got: ${actual}`);
  }
};

/** Minimal stand-in for a Sequelize instance. */
const fakeInstance = (modelName, values, previous = {}, changedFields = []) => ({
  constructor: { name: modelName, primaryKeyAttribute: Object.keys(values)[0] },
  dataValues: values,
  _previousDataValues: previous,
  changed: () => changedFields,
});

const actor = { id: 7, name: "Sana Yousaf", type: "ContentAdmin", ip: "203.0.113.9" };

console.log("\nChange-log summaries\n");

// --- describeSubject ------------------------------------------------------
check(
  "a student is named, not just numbered",
  describeSubject(fakeInstance("Student", { std_id: 42, user_name: "Ali Khan" }), "Student"),
  (s) => s.includes("Ali Khan") && s.includes("42")
);

check(
  "a candidate is named too",
  describeSubject(fakeInstance("Candidate", { cand_id: 900, cand_name: "Fatima Baloch" }), "Candidate"),
  (s) => s.includes("Fatima Baloch") && s.includes("900")
);

check(
  "a record with no name still identifies its row",
  describeSubject(fakeInstance("Attendance", { attend_id: 15 }), "Attendance"),
  (s) => s.includes("attend_id") && s.includes("15")
);

// --- diffFields -----------------------------------------------------------
const updated = fakeInstance(
  "Student",
  { std_id: 42, std_phone: "03001234567", std_district: "Quetta", updatedAt: "new" },
  { std_id: 42, std_phone: "03009999999", std_district: "Quetta", updatedAt: "old" },
  ["std_phone", "std_district", "updatedAt"]
);

const changes = diffFields(updated);
check("only genuinely changed fields are kept", changes.length, 1);
check("the changed field is the right one", changes[0]?.field, "std_phone");
check("a field set to its existing value is not a change", changes.some((c) => c.field === "std_district"), false);
check("updatedAt is treated as noise", changes.some((c) => c.field === "updatedAt"), false);

const secret = fakeInstance(
  "User",
  { user_id: 3, user_password: "new-hash" },
  { user_id: 3, user_password: "old-hash" },
  ["user_password"]
);
const secretChanges = diffFields(secret);
check("a password change is recorded...", secretChanges.length, 1);
check("...but neither value is stored", secretChanges[0], (c) => c.from === "(hidden)" && c.to === "(hidden)");

// --- buildSummary ---------------------------------------------------------
const updateSummary = buildSummary({
  actor,
  action: "updated",
  subject: 'Student "Ali Khan" (std_id 42)',
  changes: [{ field: "std_phone", from: "03009999999", to: "03001234567" }],
});

check("names the actor, their role and their id", updateSummary, (s) =>
  s.includes("Sana Yousaf") && s.includes("ContentAdmin") && s.includes("user_id 7")
);
check("names the affected record", updateSummary, (s) => s.includes("Ali Khan") && s.includes("std_id 42"));
check("states the old and new values", updateSummary, (s) =>
  s.includes("03009999999") && s.includes("03001234567")
);

check(
  "two changes read as a list, not a dump",
  buildSummary({
    actor,
    action: "updated",
    subject: "Candidate (cand_id 12)",
    changes: [
      { field: "cand_phone", from: "1", to: "2" },
      { field: "cand_email", from: "a@b.c", to: "d@e.f" },
    ],
  }),
  (s) => s.includes(" and ") && s.includes("cand_phone") && s.includes("cand_email")
);

check("an empty value reads as (empty), not blank",
  buildSummary({
    actor,
    action: "updated",
    subject: "Student (std_id 1)",
    changes: [{ field: "std_district", from: null, to: "Quetta" }],
  }),
  (s) => s.includes("(empty)") && s.includes("Quetta")
);

check("creation is described as creation",
  buildSummary({ actor, action: "created", subject: "Center (center_id 4)", changes: [] }),
  (s) => s.includes("created") && s.includes("Center")
);

check("deletion is described as deletion",
  buildSummary({ actor, action: "deleted", subject: "Course (course_id 4)", changes: [] }),
  (s) => s.includes("deleted") && s.includes("Course")
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
