const Trainer = require("../models/trainersModel");
const Student = require("../models/studentModel");
const TrainerCenterAllocation = require("../models/trainersCenterAllocationModel");
const { ROLES, ADMIN_ROLES } = require("../middleware/authMiddleware");
const { allocationScope, teachesClass } = require("./trainerScope");

/**
 * Who may see and do what in the assignment module.
 *
 * One definition, because the module previously answered the question
 * differently in every controller - and got it wrong in the same way each time:
 * when the viewer's record could not be found, the WHERE clause was simply left
 * unscoped and they saw every assignment in the batch. A missing student row
 * meant more access, not less.
 *
 * Identity always comes from req.user, never from a query string or body. The
 * old endpoints took `user_id` from the client, so anyone could read another
 * person's assignments by changing a number in the URL.
 */

const isAdminRole = (role) => ADMIN_ROLES.includes(role);

/**
 * Everything needed to scope a request, resolved once.
 *
 * @returns {Promise<{role: string, isAdmin: boolean, trainer: object|null,
 *   allocations: Array, student: object|null}>}
 */
const resolveViewer = async (user, tb_id) => {
  const role = String(user?.role || "").trim().toLowerCase();

  if (role === ROLES.TRAINER) {
    const trainer = await Trainer.findOne({ where: { user_id: user.id } });
    if (!trainer) return { role, isAdmin: false, trainer: null, allocations: [], student: null };

    // Every allocation, not the first. A trainer teaching three centres was
    // being scoped to one of them by findOne elsewhere in this codebase.
    const allocations = await TrainerCenterAllocation.findAll({
      where: { t_id: trainer.t_id, ...(tb_id ? { tb_id } : {}) },
    });

    return { role, isAdmin: false, trainer, allocations, student: null };
  }

  if (role === ROLES.STUDENT) {
    const student = await Student.findOne({ where: { user_id: user.id } });
    return { role, isAdmin: false, trainer: null, allocations: [], student };
  }

  return {
    role,
    isAdmin: isAdminRole(role),
    trainer: null,
    allocations: [],
    student: null,
  };
};

/**
 * The WHERE fragment limiting assignments to what this viewer may see.
 *
 * Returns null for "nothing" - a viewer whose record is missing, or a role with
 * no business here. Callers MUST treat null as an empty result rather than as
 * "no filter", which is exactly the mistake this replaces.
 */
const assignmentScopeFor = (viewer) => {
  if (viewer.isAdmin) return {};

  if (viewer.role === ROLES.TRAINER) {
    // A trainer sees the work they set. Scoped by t_id rather than by their
    // (centre, course) pairs on purpose: an assignment they wrote is theirs to
    // manage even if their allocation later changes.
    if (!viewer.trainer) return null;
    return { t_id: viewer.trainer.t_id };
  }

  if (viewer.role === ROLES.STUDENT) {
    if (!viewer.student) return null;
    return {
      center_id: viewer.student.center_id,
      course_id: viewer.student.course_id,
    };
  }

  // Centre managers and anyone else: their own centre if they have one,
  // otherwise nothing. Never everything.
  return null;
};

/**
 * May this viewer edit or delete this assignment?
 *
 * Admins may. The trainer who set it may. Nobody else - including another
 * trainer at the same centre, whose own work is not this.
 */
const canManageAssignment = (viewer, assignment) => {
  if (!assignment) return false;
  if (viewer.isAdmin) return true;
  if (viewer.role === ROLES.TRAINER && viewer.trainer) {
    return String(assignment.t_id) === String(viewer.trainer.t_id);
  }
  return false;
};

/**
 * May this viewer mark this submission?
 *
 * The check that was missing entirely: any signed-in user could PUT marks onto
 * any submission, so a student could grade their own work.
 */
const canMarkSubmission = (viewer, assignment) => canManageAssignment(viewer, assignment);

/**
 * May this viewer read this one submission?
 *
 * A student may read their own. Staff who can mark it may read it. Nobody else
 * - the endpoint used to hand any submission to any signed-in user given a roll
 * number, which is somebody else's marks and somebody else's work.
 */
const canReadSubmission = (viewer, assignment, submission) => {
  if (canMarkSubmission(viewer, assignment)) return true;
  if (viewer.role === ROLES.STUDENT && viewer.student && submission) {
    return String(submission.std_rollno) === String(viewer.student.std_rollno);
  }
  return false;
};

/** Is this assignment one the student is actually set? */
const belongsToStudent = (assignment, student) =>
  Boolean(assignment) &&
  Boolean(student) &&
  String(assignment.tb_id) === String(student.tb_id) &&
  String(assignment.center_id) === String(student.center_id) &&
  String(assignment.course_id) === String(student.course_id);

module.exports = {
  resolveViewer,
  assignmentScopeFor,
  canManageAssignment,
  canMarkSubmission,
  canReadSubmission,
  belongsToStudent,
  isAdminRole,
};
