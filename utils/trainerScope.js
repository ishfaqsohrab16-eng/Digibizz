const { Op } = require("sequelize");
const TrainerCenterAllocation = require("../models/trainersCenterAllocationModel");
const Trainer = require("../models/trainersModel");

/**
 * What a trainer is allowed to see, expressed correctly.
 *
 * A trainer is allocated to (center, course) PAIRS, and often several of them -
 * one person may teach online classes for three different centers. Two mistakes
 * kept being made around that, in opposite directions:
 *
 *  1. `findOne` on the allocations, then filtering by that single center and
 *     course. A trainer with three allocations then sees only one of them. This
 *     is why a dashboard could report two pending leave requests while the
 *     leave list showed none: the count looked at every allocation, the list
 *     looked at the first.
 *
 *  2. `center_id IN (...) AND course_id IN (...)`. That is the CROSS PRODUCT of
 *     the two lists, not the pairs. A trainer teaching Digital at BUITEMS and
 *     Creative at UoB also matches Digital-at-UoB and Creative-at-BUITEMS -
 *     classes they do not teach. It over-counts on a dashboard and, on a data
 *     endpoint, shows another trainer's students.
 *
 * Both are avoided by asking for the pairs and nothing else.
 */

/**
 * One entry per class the trainer actually teaches.
 *
 * THE ALLOCATION TABLE HAS NO UNIQUE KEY, so the same (center, course) pair
 * can appear on it more than once. Anything that writes a row PER ALLOCATION
 * then writes it twice, and anything that counts allocations counts the class
 * twice.
 *
 * That has already bitten three features. Announcements and daily lecture
 * reports each grew their own copy of this loop after somebody reported
 * seeing everything twice; assignments did not get one, and a trainer setting
 * one piece of work got two identical rows in the list - which then deleted
 * together, because deleting an assignment removes the whole set it was
 * created with.
 *
 * So it lives here now, and the next feature that fans out over allocations
 * has something to reach for.
 *
 * Order is preserved and the FIRST of each pair is kept, so the row a caller
 * gets is a real allocation with its own id, not a synthesised one.
 */
const distinctClasses = (allocations) => {
  const seen = new Set();
  const classes = [];

  for (const allocation of allocations || []) {
    const key = `${allocation.center_id}|${allocation.course_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    classes.push(allocation);
  }

  return classes;
};

/** Allocations for one trainer in one batch, by their user id. */
const getTrainerAllocations = async (user_id, tb_id) => {
  const trainer = await Trainer.findOne({ where: { user_id } });
  if (!trainer) return { trainer: null, allocations: [] };

  const where = { t_id: trainer.t_id };
  if (tb_id !== undefined && tb_id !== null && tb_id !== "") {
    where.tb_id = tb_id;
  }

  const allocations = await TrainerCenterAllocation.findAll({ where });
  return { trainer, allocations };
};

/**
 * A WHERE fragment matching exactly the trainer's (center, course) pairs.
 *
 * Returns null when there are no allocations, which callers must treat as
 * "matches nothing" rather than "matches everything" - the difference between
 * an empty list and every student in the program.
 *
 * @param {Array<{center_id: number, course_id: number}>} allocations
 * @param {object} [options]
 * @param {string} [options.centerField]
 * @param {string} [options.courseField]
 */
const allocationScope = (
  allocations,
  { centerField = "center_id", courseField = "course_id" } = {}
) => {
  if (!allocations || allocations.length === 0) return null;

  // De-duplicated: the same pair can be allocated twice, which would otherwise
  // produce a redundant OR branch on every query.
  const seen = new Set();
  const pairs = [];

  for (const allocation of allocations) {
    const key = `${allocation.center_id}|${allocation.course_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({
      [centerField]: allocation.center_id,
      [courseField]: allocation.course_id,
    });
  }

  // A single pair needs no OR wrapper, which keeps the common case readable in
  // query logs.
  return pairs.length === 1 ? pairs[0] : { [Op.or]: pairs };
};

/**
 * Merge the scope into an existing where clause.
 *
 * Uses Op.and so a caller's own Op.or (a search box, say) is not overwritten by
 * the scope's - two Op.or keys on one object silently lose one of them.
 */
const withAllocationScope = (where, allocations, options) => {
  const scope = allocationScope(allocations, options);
  if (!scope) return null;
  return { [Op.and]: [where || {}, scope] };
};

/** Distinct center ids, for the places that legitimately need only centers. */
const allocationCenterIds = (allocations) => [
  ...new Set((allocations || []).map((a) => a.center_id)),
];

/** Distinct course ids. */
const allocationCourseIds = (allocations) => [
  ...new Set((allocations || []).map((a) => a.course_id)),
];

/** Does this trainer teach this exact class? */
const teachesClass = (allocations, center_id, course_id) =>
  (allocations || []).some(
    (a) =>
      String(a.center_id) === String(center_id) &&
      String(a.course_id) === String(course_id)
  );

/**
 * The same pair rule as a raw-SQL fragment, for the queries that are not
 * built through Sequelize.
 *
 * Returns null when there are no allocations - callers must treat that as
 * "matches nothing", never as "no filter".
 *
 * Values are coerced to integers and non-numeric entries dropped, so the
 * fragment cannot carry anything but numbers even though it is interpolated.
 *
 * @param {Array} allocations
 * @param {string} [alias] table alias, e.g. "s" for "s.center_id"
 */
const allocationSqlScope = (allocations, alias = "s") => {
  const seen = new Set();
  const pairs = [];

  for (const allocation of allocations || []) {
    const center = Number(allocation.center_id);
    const course = Number(allocation.course_id);
    if (!Number.isInteger(center) || !Number.isInteger(course)) continue;

    const key = `${center}|${course}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push(`(${alias}.center_id = ${center} AND ${alias}.course_id = ${course})`);
  }

  return pairs.length ? `(${pairs.join(" OR ")})` : null;
};

module.exports = {
  distinctClasses,
  getTrainerAllocations,
  allocationSqlScope,
  allocationScope,
  withAllocationScope,
  allocationCenterIds,
  allocationCourseIds,
  teachesClass,
};
