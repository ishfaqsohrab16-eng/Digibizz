/**
 * One-time repair: remove the duplicate assignment rows already written.
 *
 * Setting one piece of work wrote one row per ALLOCATION rather than one per
 * CLASS, and the allocation table has no unique key - so a class allocated to
 * the same trainer twice produced two identical assignments. They looked like
 * two pieces of work in the list and deleted together, because deleting an
 * assignment removes the whole set it was created with.
 *
 * The write path is fixed. This clears what it already wrote.
 *
 * WHAT COUNTS AS A DUPLICATE. Same as_group_id, same centre, same course -
 * rows that came out of a single "set assignment" action and describe the same
 * class. Two assignments that merely look alike are not touched: a trainer may
 * legitimately set the same title twice, and telling those apart is not this
 * script's business.
 *
 * WHAT IT WILL NOT DO.
 *
 *   It never deletes a row that has submissions against it. Students' work is
 *   not something to tidy away, and moving a submission to the surviving row
 *   could collide with one that student already made there. Those are listed
 *   for somebody to decide about.
 *
 *   It keeps the LOWEST as_id of each group - the one created first, which is
 *   the one the trainer has been looking at.
 *
 *   It changes nothing at all unless you pass --apply.
 *
 * Usage, from the project root:
 *
 *   node scripts/clean-duplicate-assignments.js            # dry run
 *   node scripts/clean-duplicate-assignments.js --apply
 */

require("dotenv").config();

const { Op } = require("sequelize");
const { sequelize } = require("../config/db");
const Assignment = require("../models/assignmentModel");
const AssignmentSubmission = require("../models/assignmentSubmissionModel");

const apply = process.argv.includes("--apply");

const main = async () => {
  await sequelize.authenticate();

  const assignments = await Assignment.findAll({
    attributes: ["as_id", "as_group_id", "as_title", "tb_id", "center_id", "course_id"],
    order: [["as_id", "ASC"]],
    raw: true,
  });

  /**
   * Grouped by the set they were created in, and the class they belong to.
   *
   * A row with no as_group_id predates grouping and cannot be shown to be a
   * duplicate of anything, so it is left alone.
   */
  const groups = new Map();
  for (const row of assignments) {
    if (!row.as_group_id) continue;
    const key = `${row.as_group_id}|${row.center_id}|${row.course_id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const duplicated = [...groups.values()].filter((rows) => rows.length > 1);

  console.log(
    `${assignments.length} assignments, ${duplicated.length} class(es) with more than one row.`
  );

  if (duplicated.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  // Every candidate for deletion, checked for submissions in one query rather
  // than one per row.
  const candidates = duplicated.flatMap((rows) => rows.slice(1));
  const withWork = new Set(
    (
      await AssignmentSubmission.findAll({
        where: { as_id: { [Op.in]: candidates.map((row) => row.as_id) } },
        attributes: ["as_id"],
        raw: true,
      })
    ).map((row) => row.as_id)
  );

  const removable = candidates.filter((row) => !withWork.has(row.as_id));
  const kept = candidates.filter((row) => withWork.has(row.as_id));

  for (const rows of duplicated) {
    const extras = rows.slice(1);
    const safe = extras.filter((row) => !withWork.has(row.as_id));
    console.log(
      `  "${rows[0].as_title}" (batch ${rows[0].tb_id}, centre ${rows[0].center_id}): ` +
        `${rows.length} rows, keeping ${rows[0].as_id}, ` +
        `removing ${safe.length ? safe.map((r) => r.as_id).join(", ") : "none"}` +
        (safe.length < extras.length ? "  [some have submissions]" : "")
    );
  }

  if (apply && removable.length > 0) {
    await Assignment.destroy({
      where: { as_id: { [Op.in]: removable.map((row) => row.as_id) } },
    });
  }

  console.log("");
  console.log(`  ${removable.length} ${apply ? "removed" : "would be removed"}`);
  console.log(`  ${kept.length} left alone - they have student submissions against them`);

  if (kept.length > 0) {
    console.log("");
    console.log(
      "A duplicate carrying submissions means students answered the copy. " +
        "Decide per case whether to mark that work against the original or " +
        "leave both; deleting it would take their submissions with it."
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
    console.error("Cleanup failed:", error.message);
    try {
      await sequelize.close();
    } catch {
      /* already gone */
    }
    process.exit(1);
  });
