/**
 * One-time repair at the source: remove duplicate rows from
 * trainers_center_allocation.
 *
 * A trainer is allocated to (centre, course) PAIRS in a batch. The table has
 * no unique key on that combination, so the same class can be recorded against
 * the same trainer twice - usually from an allocation screen being submitted
 * twice, or a re-import.
 *
 * A duplicate row means nothing on its own; the trainer teaches that class
 * once either way. What it does is break everything that fans out over
 * allocations. Setting one assignment wrote two, which then deleted together.
 * Announcements and daily lecture reports each hit the same thing before that,
 * and each grew its own de-duplicating loop in response.
 *
 * Those loops now live in one place (utils/trainerScope.js, distinctClasses)
 * so nothing writes doubles any more. This clears the rows that caused it, so
 * the next feature to read this table is not relying on remembering.
 *
 * SAFE TO RUN. tca_id is the primary key and nothing in the codebase refers to
 * it - no other table carries an allocation id - so removing a redundant row
 * removes only the redundancy. The lowest id of each set is kept.
 *
 * It changes nothing unless you pass --apply.
 *
 * Usage, from the project root:
 *
 *   node scripts/clean-duplicate-allocations.js            # dry run
 *   node scripts/clean-duplicate-allocations.js --apply
 */

require("dotenv").config();

const { Op } = require("sequelize");
const { sequelize } = require("../config/db");
const TrainerCenterAllocation = require("../models/trainersCenterAllocationModel");

const apply = process.argv.includes("--apply");

const main = async () => {
  await sequelize.authenticate();

  const allocations = await TrainerCenterAllocation.findAll({
    attributes: ["tca_id", "t_id", "course_id", "center_id", "tb_id"],
    order: [["tca_id", "ASC"]],
    raw: true,
  });

  const groups = new Map();
  for (const row of allocations) {
    const key = `${row.t_id}|${row.tb_id}|${row.center_id}|${row.course_id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const duplicated = [...groups.values()].filter((rows) => rows.length > 1);
  const removable = duplicated.flatMap((rows) => rows.slice(1));

  console.log(
    `${allocations.length} allocations, ${groups.size} distinct classes, ` +
      `${duplicated.length} recorded more than once.`
  );

  if (duplicated.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  for (const rows of duplicated) {
    const [keep, ...extras] = rows;
    console.log(
      `  trainer ${keep.t_id}, batch ${keep.tb_id}, centre ${keep.center_id}, ` +
        `course ${keep.course_id}: ${rows.length} rows, keeping ${keep.tca_id}, ` +
        `removing ${extras.map((row) => row.tca_id).join(", ")}`
    );
  }

  if (apply) {
    await TrainerCenterAllocation.destroy({
      where: { tca_id: { [Op.in]: removable.map((row) => row.tca_id) } },
    });
  }

  console.log("");
  console.log(`  ${removable.length} ${apply ? "removed" : "would be removed"}`);

  if (apply) {
    console.log("");
    console.log(
      "With the table clean, migration/031_allocation_unique.sql can be applied " +
        "to stop it happening again."
    );
  } else {
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
