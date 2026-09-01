/**
 * Regression tests for the duplicate email / phone check.
 *
 * Run with:  node utils/contactUniqueness.test.js
 * Exits non-zero if any rule regresses. No database.
 *
 * Three tables can hold the same person's contact details - user, student and
 * candidate - and only some were being checked, in only some of the places
 * that write them. An applicant reached the INSERT before the database refused
 * it, and got a 500 mentioning Sequelize for what is simply "that address is
 * taken".
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

const { findContactConflict, phoneKey } = require("./contactUniqueness");

const reset = () => {
  db.users = [];
  db.candidates = [];
  db.students = [];
};

(async () => {
  console.log("\nComparing phone numbers\n");

  // The same line written the three ways people actually write it.
  check("local form", phoneKey("03001234567"), "001234567");
  check(
    "dashes are ignored",
    phoneKey("0300-1234567") === phoneKey("03001234567")
  );
  check(
    "spaces are ignored",
    phoneKey("0300 123 4567") === phoneKey("03001234567")
  );
  // A number saved with the country code is the same number.
  check(
    "the country code does not make it a different number",
    phoneKey("+923001234567") === phoneKey("03001234567"),
    `${phoneKey("+923001234567")} vs ${phoneKey("03001234567")}`
  );

  console.log("\nEmail addresses\n");

  reset();
  check("a free address is free", (await findContactConflict({ email: "new@x.com" })) === null);

  reset();
  db.users = [{ user_id: 1, user_email: "taken@x.com" }];
  let conflict = await findContactConflict({ email: "taken@x.com" });
  check("one already on a user account is refused", conflict?.field === "email");
  check(
    "and the message tells the applicant what to do",
    /different one/.test(conflict?.message || ""),
    conflict?.message
  );

  // The table that was being missed: somebody who applied but is not yet a user.
  reset();
  db.candidates = [{ cand_id: 7, cand_email: "applied@x.com" }];
  check(
    "one already on a candidate application is refused",
    (await findContactConflict({ email: "applied@x.com" }))?.field === "email"
  );

  reset();
  db.users = [{ user_id: 1, user_email: "taken@x.com" }];
  check(
    "casing does not let a duplicate through",
    (await findContactConflict({ email: "  TAKEN@X.com " }))?.field === "email"
  );

  console.log("\nPhone numbers\n");

  reset();
  db.candidates = [{ cand_id: 7, cand_phone: "0300-1234567" }];
  check(
    "a number already on an application is refused",
    (await findContactConflict({ phone: "03001234567" }))?.field === "phone"
  );

  reset();
  db.students = [{ std_id: 3, std_phone: "+92 300 1234567" }];
  check(
    "however it was written down",
    (await findContactConflict({ phone: "0300-1234567" }))?.field === "phone"
  );

  reset();
  db.students = [{ std_id: 3, std_phone: "03009999999" }];
  check(
    "a different number is not a conflict",
    (await findContactConflict({ phone: "03001234567" })) === null
  );

  // Matching on a handful of digits would collide with half the table.
  reset();
  db.students = [{ std_id: 3, std_phone: "03001234567" }];
  check(
    "something too short to be a number is not matched",
    (await findContactConflict({ phone: "4567" })) === null
  );

  console.log("\nEditing your own record\n");

  // Saving an unchanged email must not be a conflict with yourself.
  reset();
  db.users = [{ user_id: 42, user_email: "mine@x.com" }];
  check(
    "your own address is not taken by you",
    (await findContactConflict({ email: "mine@x.com" }, { user_id: 42 })) === null
  );
  check(
    "but somebody else's still is",
    (await findContactConflict({ email: "mine@x.com" }, { user_id: 99 }))?.field ===
      "email"
  );

  reset();
  db.students = [{ std_id: 5, std_phone: "03001234567" }];
  check(
    "the same holds for your own phone number",
    (await findContactConflict({ phone: "03001234567" }, { std_id: 5 })) === null
  );

  console.log("\nNothing to check\n");

  reset();
  check("no email and no phone is not a conflict", (await findContactConflict({})) === null);
  check(
    "blank values are not a conflict",
    (await findContactConflict({ email: "  ", phone: "" })) === null
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((error) => {
  console.error("test run failed:", error);
  process.exit(1);
});
