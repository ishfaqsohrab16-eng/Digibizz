const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Op } = require("sequelize");
const Assignment = require("../models/assignmentModel");
const Center = require("../models/center");
const Course = require("../models/course");
const TrainingBatch = require("../models/trainingBatcheModel");
const Trainer = require("../models/trainersModel");
const trainers_center_allocation = require("../models/trainersCenterAllocationModel");
const { distinctClasses } = require("../utils/trainerScope");
const User = require("../models/userModel");
const Student = require("../models/studentModel");
const AssignmentSubmission = require("../models/assignmentSubmissionModel");
const { validationResult } = require("express-validator");
const { sequelize } = require("../config/db");
const {
  resolveViewer,
  assignmentScopeFor,
  canManageAssignment,
} = require("../utils/assignmentAccess");
const {
  submissionStatistics,
  isPastDeadline,
  minutesUntilDeadline,
} = require("../utils/assignmentRules");

/** Where uploaded attachments live, for deleting the orphans. */
const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "user-assignments");

/**
 * Remove an attachment from disk.
 *
 * Best-effort and deliberately quiet about a missing file: the row is the
 * record, and failing a delete because a file was already gone would leave the
 * assignment undeletable. The path is resolved and confined to the upload
 * directory, so a stored value cannot reach outside it.
 */
const removeAttachment = (storedPath) => {
  if (!storedPath) return;
  try {
    const name = path.basename(String(storedPath));
    const full = path.join(UPLOAD_DIR, name);
    if (!full.startsWith(UPLOAD_DIR)) return;
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch (error) {
    console.warn(`[assignment] could not remove ${storedPath}:`, error.message);
  }
};

/** First validation failure, phrased for the person who typed it. */
const firstValidationError = (req) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return null;
  const first = errors.array()[0];
  return first?.msg || "Some of those details are not valid";
};

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Set an assignment for every class the trainer teaches in this batch.
 *
 * One row per (centre, course) allocation, because students are listed per
 * class and a single shared row could not carry per-class submissions. The rows
 * share an `as_group_id` so that editing or deleting later acts on the set -
 * without it, changing a title changed it for one centre and left the others
 * showing the old one.
 */
exports.createAssignment = async (req, res) => {
  const invalid = firstValidationError(req);
  if (invalid) {
    return res.status(400).json({ success: false, message: invalid });
  }

  try {
    const { as_title, as_description, as_deadline, as_marks, tb_id } = req.body;

    const trainingBatch = await TrainingBatch.findByPk(tb_id);
    if (!trainingBatch) {
      return res
        .status(400)
        .json({ success: false, message: "That training batch does not exist" });
    }

    // Whose assignment this is. Taken from the signed-in user, never from the
    // body: `user_id` used to come from the request, so anyone could create
    // assignments in another trainer's name.
    const viewer = await resolveViewer(req.user, tb_id);

    let trainer = viewer.trainer;
    if (!trainer) {
      // An admin may set work on a trainer's behalf, but must say which one.
      if (viewer.isAdmin && req.body.user_id) {
        trainer = await Trainer.findOne({ where: { user_id: req.body.user_id } });
      }
      if (!trainer) {
        return res.status(400).json({
          success: false,
          message: viewer.isAdmin
            ? "Choose the trainer this assignment is for"
            : "No trainer record is linked to your account",
        });
      }
    }

    const trainerAllocations = await trainers_center_allocation.findAll({
      where: { t_id: trainer.t_id, tb_id },
      raw: true,
    });

    if (trainerAllocations.length === 0) {
      return res.status(400).json({
        success: false,
        message: "That trainer is not allocated to any class in this batch",
      });
    }

    /**
     * One row per CLASS, not per allocation row.
     *
     * A class can be allocated to the same trainer twice - the table has no
     * unique key on it - and this loop wrote one assignment per row it was
     * handed. That is why setting one piece of work produced two identical
     * entries in the list, and why deleting one removed both: they share an
     * as_group_id, and deleting an assignment deletes the whole set.
     */
    const classes = distinctClasses(trainerAllocations);

    const as_attachment = req.file
      ? `/uploads/user-assignments/${req.file.filename}`
      : "";

    // Ties the rows together. Generated here rather than derived from the first
    // row's id, so every row in the set has it from the moment it is written.
    const as_group_id = crypto.randomUUID();

    const created = await sequelize.transaction(async (t) => {
      // Built inside the transaction. It used to be declared outside and pushed
      // into, so a rolled-back attempt left its rows in the array and the
      // response reported assignments that do not exist.
      const rows = [];
      for (const allocation of classes) {
        rows.push(
          await Assignment.create(
            {
              as_title,
              as_description,
              as_attachment,
              as_deadline,
              as_marks,
              as_group_id,
              t_id: trainer.t_id,
              tb_id,
              course_id: allocation.course_id,
              center_id: allocation.center_id,
              as_added_on: new Date().toISOString().split("T")[0],
            },
            { transaction: t }
          )
        );
      }
      return rows;
    });

    console.log(
      `[assignment] "${as_title}" set for ${created.length} class(es) by user ${req.user.id}`
    );

    return res.status(201).json({
      success: true,
      message: `Assignment set for ${created.length} class${
        created.length === 1 ? "" : "es"
      }`,
      data: created,
    });
  } catch (error) {
    // The file is already on disk by the time the controller runs, so a failure
    // here leaves it orphaned unless it is cleaned up.
    if (req.file) removeAttachment(req.file.filename);
    console.error("Assignment creation error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not create the assignment",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

exports.getAssignmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const assignment = await Assignment.findByPk(id, {
      include: [
        { model: Center, attributes: ["center_name"] },
        { model: Course, attributes: ["course_name"] },
        { model: TrainingBatch, attributes: ["tb_name"] },
      ],
    });

    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }

    // Reading one assignment is subject to the same scoping as listing them.
    // Without this, a student could read another class's brief by guessing an
    // id - and this endpoint was unreachable, so nobody noticed it had no check.
    const viewer = await resolveViewer(req.user, assignment.tb_id);
    const scope = assignmentScopeFor(viewer);

    const permitted =
      scope !== null &&
      Object.entries(scope).every(
        ([field, value]) => String(assignment[field]) === String(value)
      );

    if (!permitted) {
      return res
        .status(403)
        .json({ success: false, message: "That assignment is not yours to view" });
    }

    return res.json({ success: true, data: assignment });
  } catch (error) {
    console.error("Assignment fetch error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Could not load the assignment" });
  }
};

/**
 * Every assignment in a batch that the signed-in user is entitled to see.
 *
 * The identity used to come from `?user_id=`, so one person could read another
 * person's list by editing the URL. Worse, when the matching trainer or student
 * row could not be found the WHERE clause was left unscoped and they saw the
 * whole batch - a missing record granted MORE access. Both are gone: identity
 * comes from the token, and an unresolvable viewer sees nothing.
 */
exports.getAllAssignmentsByTB = async (req, res) => {
  try {
    const invalid = firstValidationError(req);
    if (invalid) {
      return res.status(400).json({ success: false, message: invalid });
    }

    const { tb_id } = req.params;
    const viewer = await resolveViewer(req.user, tb_id);
    const scope = assignmentScopeFor(viewer);

    if (scope === null) {
      return res.status(200).json({
        success: true,
        data: [],
        message:
          viewer.role === "student"
            ? "Your student record could not be found, so no assignments can be listed"
            : "You have no classes in this batch",
      });
    }

    const assignments = await Assignment.findAll({
      where: { tb_id, ...scope },
      include: [
        { model: Course, attributes: ["course_name"] },
        { model: Center, attributes: ["center_name"] },
        { model: TrainingBatch, attributes: ["tb_name"] },
        {
          model: Trainer,
          attributes: ["user_id"],
          include: [
            {
              model: User,
              as: "user",
              attributes: ["user_id", "user_name", "user_email"],
            },
          ],
        },
      ],
      order: [["as_added_on", "DESC"], ["as_id", "DESC"]],
    });

    if (assignments.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    // One query for every submission in this batch, then grouped in memory.
    // It used to run two queries PER assignment inside a Promise.all, so a
    // trainer with thirty assignments made sixty round trips to render a list.
    const assignmentIds = assignments.map((a) => a.as_id);
    const submissions = await AssignmentSubmission.findAll({
      where: { as_id: { [Op.in]: assignmentIds }, tb_id },
      raw: true,
    });

    const byAssignment = new Map();
    for (const submission of submissions) {
      if (!byAssignment.has(submission.as_id)) byAssignment.set(submission.as_id, []);
      byAssignment.get(submission.as_id).push(submission);
    }

    const isStaff = viewer.isAdmin || viewer.role === "trainer";

    // Class sizes, also in one query rather than one per assignment.
    const classSizes = new Map();
    if (isStaff) {
      const counts = await Student.findAll({
        where: {
          tb_id,
          center_id: { [Op.in]: [...new Set(assignments.map((a) => a.center_id))] },
          course_id: { [Op.in]: [...new Set(assignments.map((a) => a.course_id))] },
          std_lms_status: { [Op.ne]: 2 },
        },
        attributes: ["center_id", "course_id"],
        raw: true,
      });
      for (const row of counts) {
        const key = `${row.center_id}|${row.course_id}`;
        classSizes.set(key, (classSizes.get(key) || 0) + 1);
      }
    }

    const data = assignments.map((assignment) => {
      const plain = assignment.get({ plain: true });
      const mine = byAssignment.get(assignment.as_id) || [];

      // Useful to every role, and previously computed in three different places
      // in the browser from a string column.
      plain.deadlinePassed = isPastDeadline(assignment.as_deadline);
      plain.minutesRemaining = minutesUntilDeadline(assignment.as_deadline);

      if (isStaff) {
        const size = classSizes.get(`${assignment.center_id}|${assignment.course_id}`) || 0;
        plain.statistics = submissionStatistics(mine, size);
        return plain;
      }

      if (viewer.role === "student" && viewer.student) {
        const own = mine.find(
          (submission) =>
            String(submission.std_rollno) === String(viewer.student.std_rollno)
        );

        plain.studentStats = {
          hasSubmitted: Boolean(own),
          obtainedMarks: own ? own.obt_marks : null,
          submissionStatus: own ? own.as_submission_status : null,
          submissionDate: own ? own.submitted_on : null,
          submissionId: own ? own.as_submission_id : null,
          trainerComments: own ? own.trainer_comments : null,
          // Kept for the existing screens, which read `status`.
          status: own ? own.as_submission_status : null,
        };
      }

      return plain;
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Error fetching assignments:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load assignments",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/**
 * Edit an assignment, and every copy of it set at the same time.
 *
 * Three separate faults are fixed here. `Assignment.update()` returns
 * `[affectedCount]`, and the old code compared that ARRAY to 0 - which is never
 * true - so editing a non-existent assignment answered 200 with a null body
 * instead of 404. A replacement attachment was accepted by the route and never
 * read by the controller, so the file landed on disk and the assignment kept
 * the old one. And there was no ownership check at all: any caller could edit
 * anyone's assignment.
 */
exports.updateAssignment = async (req, res) => {
  try {
    const invalid = firstValidationError(req);
    if (invalid) {
      if (req.file) removeAttachment(req.file.filename);
      return res.status(400).json({ success: false, message: invalid });
    }

    const { as_id } = req.params;
    const assignment = await Assignment.findByPk(as_id);

    if (!assignment) {
      if (req.file) removeAttachment(req.file.filename);
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }

    const viewer = await resolveViewer(req.user, assignment.tb_id);
    if (!canManageAssignment(viewer, assignment)) {
      if (req.file) removeAttachment(req.file.filename);
      return res.status(403).json({
        success: false,
        message: "Only the trainer who set this assignment can change it",
      });
    }

    // Only what was actually sent. Spreading the whole body would write
    // undefined over columns the form did not include - and `as_instructions`,
    // which the old code wrote, is not a column at all, so it was silently
    // dropped on every save.
    const changes = {};
    for (const field of ["as_title", "as_description", "as_marks", "as_deadline", "as_status"]) {
      if (req.body[field] !== undefined) changes[field] = req.body[field];
    }

    const previousAttachment = assignment.as_attachment;
    if (req.file) {
      changes.as_attachment = `/uploads/user-assignments/${req.file.filename}`;
    }

    if (Object.keys(changes).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Nothing was sent to change",
      });
    }

    // The copies set together are edited together. Without this, correcting a
    // title changed it for one centre and left the others showing the old one.
    const where = assignment.as_group_id
      ? { as_group_id: assignment.as_group_id }
      : { as_id };

    const [updatedCount] = await Assignment.update(changes, { where });

    if (updatedCount === 0) {
      if (req.file) removeAttachment(req.file.filename);
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }

    // Only once the new one is safely stored.
    if (req.file && previousAttachment) removeAttachment(previousAttachment);

    const updated = await Assignment.findByPk(as_id);

    console.log(
      `[assignment] ${as_id} updated (${updatedCount} class copies) by user ${req.user.id}`
    );

    return res.json({
      success: true,
      message:
        updatedCount > 1
          ? `Assignment updated for all ${updatedCount} classes`
          : "Assignment updated",
      assignment: updated,
      updatedCount,
    });
  } catch (error) {
    if (req.file) removeAttachment(req.file.filename);
    console.error("Assignment update error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Could not update the assignment" });
  }
};

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Delete an assignment and everything submitted against it.
 *
 * This destroys students' work, and until now any caller at all could do it to
 * any assignment - the route had no authentication and the controller had no
 * ownership check.
 */
exports.deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;

    const assignment = await Assignment.findByPk(id);
    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: "Assignment not found" });
    }

    const viewer = await resolveViewer(req.user, assignment.tb_id);
    if (!canManageAssignment(viewer, assignment)) {
      return res.status(403).json({
        success: false,
        message: "Only the trainer who set this assignment can delete it",
      });
    }

    // The whole set, so a deleted assignment does not linger at the other
    // centres it was set for.
    const siblings = assignment.as_group_id
      ? await Assignment.findAll({ where: { as_group_id: assignment.as_group_id } })
      : [assignment];

    const ids = siblings.map((row) => row.as_id);

    const attachments = await AssignmentSubmission.findAll({
      where: { as_id: { [Op.in]: ids } },
      attributes: ["as_submission_attachment"],
      raw: true,
    });

    const result = await sequelize.transaction(async (t) => {
      const submissionsDeleted = await AssignmentSubmission.destroy({
        where: { as_id: { [Op.in]: ids } },
        transaction: t,
      });
      const assignmentsDeleted = await Assignment.destroy({
        where: { as_id: { [Op.in]: ids } },
        transaction: t,
      });
      return { submissionsDeleted, assignmentsDeleted };
    });

    // After the commit: a rolled-back delete must not have removed the files
    // its rows still point at.
    for (const row of siblings) removeAttachment(row.as_attachment);
    for (const row of attachments) removeAttachment(row.as_submission_attachment);

    console.log(
      `[assignment] ${ids.join(", ")} deleted with ${result.submissionsDeleted} submission(s) by user ${req.user.id}`
    );

    return res.json({
      success: true,
      message: `Assignment deleted, along with ${result.submissionsDeleted} submission(s)`,
      data: {
        submissionsDeleted: result.submissionsDeleted,
        assignmentsDeleted: result.assignmentsDeleted,
      },
    });
  } catch (error) {
    console.error("Assignment deletion error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not delete the assignment",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
