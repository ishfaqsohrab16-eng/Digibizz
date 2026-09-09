/**
 * Show what the candidate record holds and what the student record holds,
 * side by side, for one person.
 *
 * "The district is not being taken from the candidate" has three quite
 * different causes that look identical on screen, and no amount of reading the
 * code separates them:
 *
 *   THE CANDIDATE ROW IS BLANK. Nothing was ever captured, so enrolment had
 *   nothing to copy. The fix is upstream, in the application form.
 *
 *   THE CANDIDATE HAS IT AND THE STUDENT DOES NOT. The copy at enrolment is
 *   genuinely broken, or the row predates it. scripts/backfill-student-details.js
 *   repairs the backlog.
 *
 *   BOTH ROWS HAVE IT. Then the data is fine and something between the
 *   database and the screen is dropping it - a different question entirely,
 *   and worth knowing before anybody edits the enrolment code again.
 *
 * Values are printed inside quotes with their length, because "  " and "" and
 * null all render as nothing at all and mean different things.
 *
 * Usage, from the project root - CNIC, roll number or candidate id:
 *
 *   node scripts/check-student-details.js 35202-1234567-1
 *   node scripts/check-student-details.js DB10-0207366-5
 *   node scripts/check-student-details.js 12559
 */

require("dotenv").config();

const { Op } = require("sequelize");
const { sequelize } = require("../config/db");
const Student = require("../models/studentModel");
const Candidate = require("../models/CandidateModel");
const { normaliseCnic } = require("../utils/cnicListParser");

const term = String(process.argv[2] || "").trim();

if (!term) {
  console.error("Give a CNIC, a roll number or a candidate id.");
  console.error("  node scripts/check-student-details.js 35202-1234567-1");
  process.exit(1);
}

/** A value as it actually is, not as it renders. */
const show = (value) => {
  if (value === null) return "NULL";
  if (value === undefined) return "(column not read)";
  const string = String(value);
  return `"${string}" (${string.length} chars)`;
};

const main = async () => {
  await sequelize.authenticate();

  const digits = normaliseCnic(term);
  const looksLikeId = /^\d+$/.test(term) && !digits;

  // Every spelling, because the two tables do not agree on punctuation.
  const cnicForms = digits
    ? [
        digits,
        `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`,
        term,
      ]
    : [term];

  const candidates = await Candidate.findAll({
    where: looksLikeId
      ? { cand_id: Number(term) }
      : { cand_cnic: { [Op.in]: cnicForms } },
    attributes: [
      "cand_id",
      "cand_cnic",
      "cand_name",
      "tb_id",
      "cand_local_domicile",
      "cand_degree_level",
      "degree_area",
      "current_city",
    ],
  });

  const students = await Student.findAll({
    where: digits
      ? { std_cnic: { [Op.in]: cnicForms } }
      : { [Op.or]: [{ std_rollno: term }, { std_cnic: term }] },
    attributes: [
      "std_id",
      "std_rollno",
      "std_cnic",
      "tb_id",
      "std_district",
      "std_qualification",
    ],
  });

  console.log("");
  console.log(`CANDIDATE RECORDS  (${candidates.length})`);
  if (candidates.length === 0) {
    console.log("  none found");
  }
  for (const row of candidates) {
    console.log(`  cand_id ${row.cand_id}  batch ${row.tb_id}  ${row.cand_name}`);
    console.log(`    cand_cnic            ${show(row.cand_cnic)}`);
    console.log(`    cand_local_domicile  ${show(row.cand_local_domicile)}   -> std_district`);
    console.log(`    cand_degree_level    ${show(row.cand_degree_level)}   -> std_qualification`);
    // Printed only so nobody reaches for them as a substitute: the area of a
    // degree is not its level, and where somebody lives now is not their
    // domicile.
    console.log(`    degree_area          ${show(row.degree_area)}   (not copied)`);
    console.log(`    current_city         ${show(row.current_city)}   (not copied)`);
  }

  console.log("");
  console.log(`STUDENT RECORDS  (${students.length})`);
  if (students.length === 0) {
    console.log("  none found - this person has not been enrolled");
  }
  for (const row of students) {
    console.log(`  std_id ${row.std_id}  batch ${row.tb_id}  ${row.std_rollno}`);
    console.log(`    std_cnic           ${show(row.std_cnic)}`);
    console.log(`    std_district       ${show(row.std_district)}`);
    console.log(`    std_qualification  ${show(row.std_qualification)}`);
  }

  // The reading, spelled out, so the next step does not depend on
  // interpreting the dump correctly.
  console.log("");
  if (candidates.length > 0 && students.length > 0) {
    const candidate = candidates[0];
    const student = students[0];
    const candidateHas =
      String(candidate.cand_local_domicile || "").trim() ||
      String(candidate.cand_degree_level || "").trim();
    const studentHas =
      String(student.std_district || "").trim() ||
      String(student.std_qualification || "").trim();

    if (!candidateHas) {
      console.log(
        "READING: the candidate record is blank, so enrolment had nothing to " +
          "copy. This is an application that never captured the fields - fixing " +
          "enrolment will not change it."
      );
    } else if (!studentHas) {
      console.log(
        "READING: the candidate has the details and the student does not, so " +
          "the copy did not happen for this row. Run " +
          "scripts/backfill-student-details.js to repair it and anything like it."
      );
    } else {
      console.log(
        "READING: both rows hold the details, so the database is right and " +
          "something between it and the screen is dropping them. The enrolment " +
          "code is not the problem."
      );
    }
  }
};

main()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Check failed:", error.message);
    try {
      await sequelize.close();
    } catch {
      /* already gone */
    }
    process.exit(1);
  });
