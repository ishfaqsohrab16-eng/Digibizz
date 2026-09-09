/**
 * One-time repair: give already-enrolled students the district and
 * qualification from the candidate record they were enrolled from.
 *
 * Enrolling copies an applicant's details onto their student row. Students who
 * were enrolled before that copying existed - or from a candidate record that
 * was itself blank - have empty columns, and nothing fills them in afterwards
 * because nothing looks back at the application once somebody is a student.
 *
 * WHAT IT WILL NOT DO
 *
 *   It never overwrites a value that is already there. A district somebody
 *   typed in by hand is better evidence than a form filled in a year ago, and
 *   this cannot be the reason a correction gets undone.
 *
 *   It never invents one. A student whose candidate record is also blank is
 *   reported and skipped - see utils/candidateProfile.js for why guessing
 *   between columns is worse than leaving the gap.
 *
 *   It changes nothing at all unless you pass --apply.
 *
 * WHAT THE REPORT TELLS YOU. The counts answer the question behind the repair:
 * if most rows come back "candidate had nothing to copy", the gap is upstream
 * in the applications and no amount of backfilling will fix the next intake;
 * if most come back "filled", it was the copy at enrolment and the backlog is
 * now cleared.
 *
 * Usage, from the project root:
 *
 *   node scripts/backfill-student-details.js              # dry run, changes nothing
 *   node scripts/backfill-student-details.js --apply      # writes
 *   node scripts/backfill-student-details.js --batch 12   # one batch only
 *   node scripts/backfill-student-details.js --apply --verbose
 */

require("dotenv").config();

const { Op } = require("sequelize");
const { sequelize } = require("../config/db");
const Student = require("../models/studentModel");
const Candidate = require("../models/CandidateModel");
const { normaliseCnic } = require("../utils/cnicListParser");
const { isBlank, profileFromCandidate } = require("../utils/candidateProfile");

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const verbose = args.includes("--verbose");

const batchArg = args.indexOf("--batch");
const onlyBatch = batchArg !== -1 ? Number(args[batchArg + 1]) : null;

if (batchArg !== -1 && !Number.isInteger(onlyBatch)) {
  console.error("--batch needs a batch id, e.g. --batch 12");
  process.exit(1);
}

/**
 * Candidates by CNIC, digits only.
 *
 * The two tables do not agree on punctuation - one holds 35202-1234567-1 and
 * the other 3520212345671 - so matching on the stored string finds nothing for
 * a good half of them.
 *
 * A CNIC can appear in more than one batch, from somebody who applied twice.
 * The student's own batch decides which record is theirs, and the newest
 * application is the fallback when no batch matches, since it is the most
 * recent thing they told us about themselves.
 */
const indexCandidates = (rows) => {
  const byCnic = new Map();

  for (const row of rows) {
    const key = normaliseCnic(row.cand_cnic);
    if (!key) continue;
    if (!byCnic.has(key)) byCnic.set(key, []);
    byCnic.get(key).push(row);
  }

  return byCnic;
};

const pickCandidate = (candidates, student) => {
  if (!candidates || candidates.length === 0) return null;

  const sameBatch = candidates.filter(
    (row) => Number(row.tb_id) === Number(student.tb_id)
  );
  const pool = sameBatch.length > 0 ? sameBatch : candidates;

  return pool.reduce((newest, row) =>
    Number(row.cand_id) > Number(newest.cand_id) ? row : newest
  );
};

const main = async () => {
  await sequelize.authenticate();

  const where = onlyBatch ? { tb_id: onlyBatch } : {};

  const students = await Student.findAll({
    where,
    attributes: ["std_id", "std_cnic", "tb_id", "std_district", "std_qualification"],
  });

  // Only the ones with something missing. Reading every student and filtering
  // here rather than in SQL keeps "blank" meaning one thing - see isBlank,
  // which also treats the string "null" as empty.
  const gaps = students.filter(
    (student) => isBlank(student.std_district) || isBlank(student.std_qualification)
  );

  console.log(
    `${students.length} students${onlyBatch ? ` in batch ${onlyBatch}` : ""}, ` +
      `${gaps.length} with a missing district or qualification.`
  );

  if (gaps.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  const candidates = await Candidate.findAll({
    where: {
      cand_cnic: {
        [Op.in]: [
          ...new Set(
            gaps.flatMap((student) => {
              const digits = normaliseCnic(student.std_cnic);
              if (!digits) return [];
              // Both spellings, because either table may hold either.
              return [
                digits,
                `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`,
                String(student.std_cnic || "").trim(),
              ];
            })
          ),
        ],
      },
    },
    attributes: ["cand_id", "cand_cnic", "tb_id", "cand_local_domicile", "cand_degree_level"],
  });

  const byCnic = indexCandidates(candidates);

  const filled = [];
  const candidateBlank = [];
  const noCandidate = [];

  for (const student of gaps) {
    const candidate = pickCandidate(byCnic.get(normaliseCnic(student.std_cnic)), student);

    if (!candidate) {
      noCandidate.push(student);
      continue;
    }

    const available = profileFromCandidate(candidate);

    // Only the columns that are BOTH empty on the student and present on the
    // candidate. A student missing only a district keeps the qualification
    // they already have, whatever the application says.
    const changes = {};
    if (isBlank(student.std_district) && available.std_district) {
      changes.std_district = available.std_district;
    }
    if (isBlank(student.std_qualification) && available.std_qualification) {
      changes.std_qualification = available.std_qualification;
    }

    if (Object.keys(changes).length === 0) {
      candidateBlank.push(student);
      continue;
    }

    if (apply) await student.update(changes);
    filled.push({ student, changes });

    if (verbose) {
      console.log(
        `  ${student.std_cnic}: ` +
          Object.entries(changes)
            .map(([column, value]) => `${column} = ${value}`)
            .join(", ")
      );
    }
  }

  console.log("");
  console.log(`  ${filled.length} ${apply ? "filled in" : "would be filled in"}`);
  console.log(`  ${candidateBlank.length} left alone - the candidate record is blank too`);
  console.log(`  ${noCandidate.length} left alone - no candidate record matches the CNIC`);

  if (candidateBlank.length > 0) {
    console.log("");
    console.log(
      "Blank candidate records mean the details were never captured at " +
        "application, so enrolment had nothing to copy. Those have to be typed " +
        "in on the student, and the registration form is where to look if new " +
        "applications are still arriving without them."
    );
  }

  if (!apply) {
    console.log("");
    console.log("Dry run - nothing was written. Re-run with --apply to make these changes.");
  }
};

main()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Backfill failed:", error.message);
    // The failure matters more than a tidy shutdown, but leaving the pool open
    // hangs the process and hides the error behind a timeout.
    try {
      await sequelize.close();
    } catch {
      /* already gone */
    }
    process.exit(1);
  });
