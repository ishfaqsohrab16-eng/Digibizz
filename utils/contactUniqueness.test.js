/**
 * Regression tests for the duplicate email / phone check.
 *
 * Run with:  node utils/contactUniqueness.test.js
 * Exits non-zero if any rule regresses. No database.
 *
 * Two different questions live in this module, and they have different answers:
 *
 *   REGISTERING - this batch's applicants, plus everyone already enrolled.
 *   Previous batches are deliberately NOT consulted: somebody who applied last
 *   year and was not selected is entitled to apply again with the same details,
 *   and checking every batch ever run refused exactly those people.
 *
 *   CREATING OR EDITING A STUDENT - enrolled students only. A candidate being
 *   enrolled IS the person whose details these are, so consulting applications
 *   would make every enrolment collide with itself.
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

const { Op } = require("sequelize");

const db = { users: [], candidates: [], students: [] };

/** Enough of a WHERE to cover equality, Op.ne and the Op.like used for phones. */
const matches = (row, where) => {
  for (const [key, condition] of Object.entries(where || {})) {
    if (condition && typeof condition === "object") {
      if (Op.ne in condition) {
        if (String(row[key]) === String(condition[Op.ne])) return false;
      } else if (Op.like in condition) {
        const pattern = String(condition[Op.like]).replace(/%/g, "");
        if (!String(row[key] ?? "").endsWith(pattern)) return false;
      } else {
        throw new Error("test stub does not handle that operator");
      }
    } else if (String(row[key]) !== String(condition)) {
      return false;
    }
  }
  return true;
};

const table = (rows) => ({
  async findOne({ where }) {
    return rows().find((row) => matches(row, where)) || null;
  },
  async findAll({ where }) {
    return rows().filter((row) => matches(row, where));
  },
});

stub("../models/userModel", table(() => db.users));
stub("../models/CandidateModel", table(() => db.candidates));
stub("../models/studentModel", table(() => db.students));

const {
  registrationConflicts,
  studentContactConflicts,
  findContactConflicts,
  phoneKey,
} = require("./contactUniqueness");

const reset = () => {
  db.users = [];
  db.candidates = [];
  db.students = [];
};

/** An enrolled student: a user row holding the email, a student row the phone. */
const enrol = ({ user_id = 1, std_id = 1, email, phone, status = 1 }) => {
  if (email) db.users.push({ user_id, user_email: email });
  db.students.push({
    std_id,
    user_id,
    std_phone: phone || "",
    std_lms_status: status,
  });
};

(async () => {
  console.log("\nComparing phone numbers\n");

  check("local form", phoneKey("03001234567"), "001234567");
  check("dashes are ignored", phoneKey("0300-1234567") === phoneKey("03001234567"));
  check("spaces are ignored", phoneKey("0300 123 4567") === phoneKey("03001234567"));
  check(
    "the country code does not make it a different number",
    phoneKey("+923001234567") === phoneKey("03001234567")
  );

  console.log("\nRegistering: this batch's applicants\n");

  reset();
  db.candidates = [
    { cand_id: 7, tb_id: 10, cand_email: "ali@x.com", cand_phone: "0300-1234567" },
  ];

  let result = await registrationConflicts(
    { email: "ali@x.com", phone: "03009999999" },
    10
  );
  check(
    "an email already applied in THIS batch is refused",
    result.fields.join() === "email",
    result.fields.join()
  );

  result = await registrationConflicts(
    { email: "new@x.com", phone: "03001234567" },
    10
  );
  check(
    "a phone already applied in THIS batch is refused",
    result.fields.join() === "phone",
    result.fields.join()
  );

  // The rule that was wrong. Somebody rejected in batch 9 must be able to
  // apply again in batch 10 - and was being refused with their own details.
  reset();
  db.candidates = [
    { cand_id: 7, tb_id: 9, cand_email: "ali@x.com", cand_phone: "0300-1234567" },
  ];
  result = await registrationConflicts(
    { email: "ali@x.com", phone: "03001234567" },
    10
  );
  check(
    "the SAME details from a PREVIOUS batch are free",
    result.conflicts.length === 0,
    result.message
  );

  console.log("\nRegistering: people already enrolled\n");

  reset();
  enrol({ email: "student@x.com", phone: "0300-1111111" });

  result = await registrationConflicts({ email: "student@x.com" }, 10);
  check("an enrolled student's email is refused", result.fields.join() === "email");

  result = await registrationConflicts({ phone: "03001111111" }, 10);
  check("an enrolled student's phone is refused", result.fields.join() === "phone");

  // A trainer or an administrator holding the address is not a student, and
  // does not block an applicant.
  reset();
  db.users = [{ user_id: 50, user_email: "trainer@x.com" }];
  result = await registrationConflicts({ email: "trainer@x.com" }, 10);
  check(
    "a member of staff's email does not block an applicant",
    result.conflicts.length === 0,
    result.message
  );

  // A removed student does not hold a place, so does not hold their details.
  reset();
  enrol({ email: "gone@x.com", phone: "0300-2222222", status: 2 });
  result = await registrationConflicts(
    { email: "gone@x.com", phone: "03002222222" },
    10
  );
  check(
    "a removed student's details are released",
    result.conflicts.length === 0,
    result.message
  );

  console.log("\nBoth at once\n");

  reset();
  enrol({ email: "taken@x.com", phone: "0300-1234567" });
  result = await registrationConflicts(
    { email: "taken@x.com", phone: "03001234567" },
    10
  );
  check("both are found", result.conflicts.length === 2, result.fields.join());
  check(
    "and one sentence covers both",
    /email address and phone number are both/.test(result.message),
    result.message
  );

  reset();
  enrol({ email: "taken@x.com", phone: "03009999999" });
  result = await registrationConflicts(
    { email: "taken@x.com", phone: "03001234567" },
    10
  );
  check("only the email is named", result.fields.join() === "email");
  check("and the phone is not mentioned", !/phone/.test(result.message), result.message);

  console.log("\nCreating or editing a student\n");

  // Applications are not consulted here. A candidate being enrolled IS the
  // person whose details these are; checking applications would make every
  // enrolment collide with itself.
  reset();
  db.candidates = [
    { cand_id: 7, tb_id: 10, cand_email: "ali@x.com", cand_phone: "0300-1234567" },
  ];
  result = await studentContactConflicts({
    email: "ali@x.com",
    phone: "03001234567",
  });
  check(
    "their own application does not block their enrolment",
    result.conflicts.length === 0,
    result.message
  );

  reset();
  enrol({ email: "other@x.com", phone: "0300-3333333" });
  result = await studentContactConflicts({ phone: "03003333333" });
  check(
    "but another enrolled student's phone does",
    result.fields.join() === "phone",
    result.fields.join()
  );

  console.log("\nEditing your own record\n");

  reset();
  enrol({ user_id: 42, std_id: 5, email: "mine@x.com", phone: "0300-4444444" });

  result = await studentContactConflicts(
    { email: "mine@x.com", phone: "03004444444" },
    { user_id: 42, std_id: 5 }
  );
  check(
    "saving your own unchanged details is not a conflict",
    result.conflicts.length === 0,
    result.message
  );

  result = await studentContactConflicts(
    { email: "mine@x.com", phone: "03004444444" },
    { user_id: 99, std_id: 99 }
  );
  check(
    "but somebody else's still are",
    result.conflicts.length === 2,
    result.fields.join()
  );

  console.log("\nNothing to check\n");

  reset();
  result = await registrationConflicts({}, 10);
  check("no email and no phone is not a conflict", result.conflicts.length === 0);

  result = await registrationConflicts({ email: "  ", phone: "" }, 10);
  check("blank values are not a conflict", result.conflicts.length === 0);

  // Matching on a handful of digits would collide with half the table.
  reset();
  enrol({ phone: "03001234567" });
  result = await registrationConflicts({ phone: "4567" }, 10);
  check(
    "something too short to be a number is not matched",
    result.conflicts.length === 0
  );

  // Omitting the batch means "do not look at applications at all", which is
  // what the student paths rely on.
  reset();
  db.candidates = [
    { cand_id: 7, tb_id: 10, cand_email: "ali@x.com", cand_phone: "0300-1234567" },
  ];
  result = await findContactConflicts(
    { email: "ali@x.com" },
    { candidatesInBatch: null, students: true }
  );
  check(
    "no batch means applications are not consulted",
    result.conflicts.length === 0
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((error) => {
  console.error("test run failed:", error);
  process.exit(1);
});
