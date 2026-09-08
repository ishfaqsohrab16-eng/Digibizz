const { ROLES } = require("../middleware/authMiddleware");

/**
 * Who may read and write a weekly M&E report.
 *
 * Three answers, and the difference between them is the whole point:
 *
 *   A MASTER TRAINER writes reports, and only about trainers teaching THEIR
 *   COURSE. That is the relationship the programme runs on: an MT owns a
 *   subject and evaluates whoever teaches it. trainers.mt_id exists and looks
 *   like the answer, but it is not maintained reliably and a trainer teaching
 *   Graphic Design is the Graphic Design MT's to evaluate either way.
 *
 *   The course is read from the ALLOCATION, per batch, so the same check also
 *   proves the trainer has a class at all. It is done against the database on
 *   every write rather than trusted from the request - a t_id in a request
 *   body is a number the browser chose.
 *
 *   ADMINS read everything and write nothing. The report carries two
 *   signatures and one of them is the Master Trainer's; an admin editing it
 *   afterwards would make the signature meaningless. They need to see what was
 *   submitted and, more usefully, what was NOT.
 *
 *   EVERYONE ELSE, including the trainer being evaluated, sees nothing here.
 *   This is a performance assessment written about someone, and how it reaches
 *   them is a conversation, not a database read.
 */

/** Admin-style roles: read every report, write none. */
const VIEWER_ROLES = [ROLES.SUPER_ADMIN, ROLES.CONTENT_ADMIN, ROLES.READONLY_ADMIN];

const roleOf = (user) => String(user?.role || user?.type || "").trim().toLowerCase();

const isMasterTrainer = (user) => roleOf(user) === ROLES.MASTER_TRAINER;

const isViewer = (user) => VIEWER_ROLES.includes(roleOf(user));

/** May this person open the module at all? */
const canUseModule = (user) => isMasterTrainer(user) || isViewer(user);

/**
 * May this person write reports?
 *
 * Master Trainers only. Deliberately NOT "anyone senior": an admin filling in
 * a Master Trainer's evaluation of a trainer they never observed is a worse
 * outcome than a missing report, because the missing one is visible.
 */
const canWrite = (user) => isMasterTrainer(user);

/**
 * Which reports may this person read?
 *
 * Returns null for "none", {} for "all", or a filter narrowing to one Master
 * Trainer's own work. Null and {} are different answers and conflating them is
 * how a scoped query becomes an unscoped one - so this never returns a bare
 * object for someone with no access.
 */
const readScope = (user, mt_id) => {
  if (isViewer(user)) return {};
  if (isMasterTrainer(user) && mt_id) return { mt_id };
  return null;
};

/**
 * May this Master Trainer report on this trainer, in this batch?
 *
 * `classes` is what the trainer is allocated to teach in the batch, read from
 * the database. One truthful answer covers both questions that matter: is this
 * my subject, and is this person actually teaching.
 *
 * An empty allocation is always false. A trainer with no class has nothing to
 * be evaluated on, and letting a report exist for one would put a grade
 * against a week that never happened.
 */
const teachesCourse = (mt_course_id, classes) => {
  if (!mt_course_id || !Array.isArray(classes) || classes.length === 0) return false;
  return classes.some((entry) => Number(entry.course_id) === Number(mt_course_id));
};

/**
 * Is this report still the MT's to change?
 *
 * A draft is. A submitted one is not: it has been signed off and an admin is
 * already looking at it, so a quiet edit afterwards would change a record
 * somebody has read. Re-opening one is a deliberate act with a person's name
 * on it, which is a different feature and not this one.
 */
const canEdit = (user, report, mt_id) => {
  if (!isMasterTrainer(user) || !report) return false;
  if (Number(report.mt_id) !== Number(mt_id)) return false;
  return report.we_status === "draft";
};

module.exports = {
  canUseModule,
  canWrite,
  readScope,
  teachesCourse,
  canEdit,
  isMasterTrainer,
  isViewer,
  VIEWER_ROLES,
};
