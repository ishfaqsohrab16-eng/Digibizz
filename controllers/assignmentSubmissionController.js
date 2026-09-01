const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const AssignmentSubmission = require("../models/assignmentSubmissionModel");
const Center = require("../models/center");
const Course = require("../models/course");
const Assignment = require("../models/assignmentModel");
const { validationResult } = require("express-validator");
const Student = require("../models/studentModel");
const User = require("../models/userModel");
const {
  resolveViewer,
  canMarkSubmission,
  canReadSubmission,
  belongsToStudent,
} = require("../utils/assignmentAccess");
const {
  validateMark,
  isPastDeadline,
  STATUS_SUBMITTED,
  STATUS_MARKED,
} = require("../utils/assignmentRules");
const { allocationScope } = require("../utils/trainerScope");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "user-assignments");

/** Best-effort removal, confined to the upload directory. */
const removeAttachment = (storedPath) => {
  if (!storedPath) return;
  try {
    const full = path.join(UPLOAD_DIR, path.basename(String(storedPath)));
    if (!full.startsWith(UPLOAD_DIR)) return;
    if (fs.existsSync(full)) fs.unlinkSync(full);
  } catch (error) {
    console.warn(`[submission] could not remove ${storedPath}:`, error.message);
  }
};

const firstValidationError = (req) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return null;
  return errors.array()[0]?.msg || "Some of those details are not valid";
};

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

/**
 * Hand in work for an assignment.
 *
 * Rewritten around three faults:
 *
 *  1. The roll number came from the request body, so a student could submit
 *     work in somebody else's name by typing their number. It now comes from
 *     the signed-in user.
 *  2. A resubmission ran DESTROY then CREATE, resetting obt_marks to "0" and
 *     the status to unmarked. A student who disliked their grade could erase
 *     it by uploading the same file again, and the trainer's feedback went with
 *     it. The row is now UPDATED, and marking is preserved.
 *  3. The deadline was never checked. The countdown on the screen was
 *     decoration; the server accepted anything, at any time.
 */
exports.createAssignmentSubmission = async (req, res) => {
  try {
    const invalid = firstValidationError(req);
    if (invalid) {
      if (req.file) removeAttachment(req.file.filename);
      return res.status(400).json({ success: false, message: invalid });
    }

    const { tb_id, as_id, as_submission_comment } = req.body;

    const viewer = await resolveViewer(req.user, tb_id);
    if (viewer.role !== "student" || !viewer.student) {
      if (req.file) removeAttachment(req.file.filename);
      return res.status(403).json({
        success: false,
        message: "Only a student can hand in work for an assignment",
      });
    }

    const student = viewer.student;

    const assignment = await Assignment.findByPk(as_id);
    if (!assignment) {
      if (req.file) removeAttachment(req.file.filename);
      return res
        .status(404)
        .json({ success: false, message: "That assignment no longer exists" });
    }

    // The assignment has to be one this student was actually set. Without this,
    // any student could submit against any assignment id in the system.
    if (!belongsToStudent(assignment, student)) {
      if (req.file) removeAttachment(req.file.filename);
      return res.status(403).json({
        success: false,
        message: "That assignment was not set for your class",
      });
    }

    const existing = await AssignmentSubmission.findOne({
      where: { std_rollno: student.std_rollno, tb_id, as_id },
    });

    // Late work is refused, but a resubmission of something already handed in
    // on time is not - a student correcting a file at 23:59 should not be
    // blocked because the clock passed while they were uploading.
    if (isPastDeadline(assignment.as_deadline) && !existing) {
      if (req.file) removeAttachment(req.file.filename);
      return res.status(409).json({
        success: false,
        code: "DEADLINE_PASSED",
        message:
          "The deadline for this assignment has passed. Ask your trainer if you need an extension.",
      });
    }

    if (!req.file && !existing && !String(as_submission_comment || "").trim()) {
      return res.status(400).json({
        success: false,
        message: "Attach your work, or write a comment, before submitting",
      });
    }

    const attachment = req.file
      ? `/uploads/user-assignments/${req.file.filename}`
      : null;

    if (existing) {
      // Marks and feedback are deliberately NOT touched. Whether resubmitting
      // should clear a mark is the trainer's decision, not a side effect.
      if (isPastDeadline(assignment.as_deadline)) {
        if (req.file) removeAttachment(req.file.filename);
        return res.status(409).json({
          success: false,
          code: "DEADLINE_PASSED",
          message: "The deadline has passed, so this submission can no longer be changed.",
        });
      }

      const previous = existing.as_submission_attachment;

      await existing.update({
        as_submission_comment:
          as_submission_comment !== undefined
            ? as_submission_comment
            : existing.as_submission_comment,
        ...(attachment ? { as_submission_attachment: attachment } : {}),
        submitted_on: new Date().toISOString().split("T")[0],
      });

      if (attachment && previous) removeAttachment(previous);

      return res.status(200).json({
        success: true,
        message: "Your submission has been updated",
        data: existing,
      });
    }

    const created = await AssignmentSubmission.create({
      std_rollno: student.std_rollno,
      tb_id,
      center_id: student.center_id,
      course_id: student.course_id,
      as_id,
      submitted_on: new Date().toISOString().split("T")[0],
      as_submission_comment: as_submission_comment || null,
      as_submission_attachment: attachment,
      trainer_comments: "",
      obt_marks: null,
      as_submission_status: STATUS_SUBMITTED,
    });

    return res.status(201).json({
      success: true,
      message: "Assignment submitted",
      data: created,
    });
  } catch (error) {
    if (req.file) removeAttachment(req.file.filename);
    console.error("Error in createAssignmentSubmission:", error);
    return res.status(500).json({
      success: false,
      message: "Could not submit your assignment",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ---------------------------------------------------------------------------
// Read one
// ---------------------------------------------------------------------------

/**
 * One student's submission.
 *
 * Previously handed any submission to any signed-in user who supplied a roll
 * number - somebody else's work and somebody else's marks - and answered 200
 * with `null` when there was nothing there.
 */
exports.getAssignmentSubmissionById = async (req, res) => {
  try {
    const { as_id, std_rollno } = req.params;

    const assignment = await Assignment.findByPk(as_id);
    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: "That assignment no longer exists" });
    }

    const viewer = await resolveViewer(req.user, assignment.tb_id);

    // A student always reads their OWN submission, whatever roll number the
    // browser sent. It is both safer and more forgiving: the roll number in the
    // URL comes from localStorage, so a stale or reformatted value would
    // otherwise refuse a student their own work.
    const targetRollNumber =
      viewer.role === "student" && viewer.student
        ? viewer.student.std_rollno
        : std_rollno;

    const submission = await AssignmentSubmission.findOne({
      where: { as_id, std_rollno: targetRollNumber },
    });

    // Checked even when there is no submission: whether a given student has
    // handed in is itself something only their trainer should be able to ask.
    // A student is asking about their own row by construction (see above), so
    // the only question left for them is whether they are a student at all.
    const permitted = submission
      ? canReadSubmission(viewer, assignment, submission)
      : canMarkSubmission(viewer, assignment) ||
        (viewer.role === "student" && Boolean(viewer.student));

    if (!permitted) {
      return res
        .status(403)
        .json({ success: false, message: "That submission is not yours to view" });
    }

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Nothing has been submitted for this assignment yet",
      });
    }

    return res.json({
      success: true,
      message: "Assignment submission fetched successfully",
      assignmentSubmission: submission,
    });
  } catch (error) {
    console.error("Assignment submission fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load the submission",
    });
  }
};

// ---------------------------------------------------------------------------
// The marking list
// ---------------------------------------------------------------------------

/**
 * Who has handed in, and who has not.
 *
 * The old version built `[Op.or]: allocations` from the trainer's classes and
 * left it as an EMPTY ARRAY for everyone else - which Sequelize renders as
 * `0 = 1`. Every admin, master trainer and centre manager therefore saw a list
 * with nobody in it and no error to explain why.
 *
 * It also returned each student's CNIC in a field named `std_rollno`, so the
 * screen showed national ID numbers where it said roll number.
 */
exports.getAssignmentSubmissionsByBatch = async (req, res) => {
  try {
    const { tb_id, as_id } = req.params;

    const assignment = await Assignment.findByPk(as_id);
    if (!assignment) {
      return res
        .status(404)
        .json({ success: false, message: "That assignment no longer exists" });
    }

    const viewer = await resolveViewer(req.user, tb_id);

    if (!canMarkSubmission(viewer, assignment)) {
      return res.status(403).json({
        success: false,
        message: "Only the trainer who set this assignment can see its submissions",
      });
    }

    // The class this assignment was set for - not every class the trainer
    // teaches. Listing all of them would show students who were never given it.
    const students = await Student.findAll({
      where: {
        tb_id,
        center_id: assignment.center_id,
        course_id: assignment.course_id,
        std_lms_status: { [Op.ne]: 2 },
      },
      include: [
        { model: User, as: "user", attributes: ["user_name"] },
        { model: Center, as: "centers", attributes: ["center_name"] },
        { model: Course, as: "courses", attributes: ["course_name"] },
      ],
    });

    const submissions = await AssignmentSubmission.findAll({
      where: { tb_id, as_id },
      include: [
        { model: Assignment, as: "Assignment", attributes: ["as_title", "as_marks"] },
      ],
      // Newest first, so the map below keeps the most recent if a duplicate
      // ever exists. It used to keep whichever the database returned first.
      order: [["as_submission_id", "DESC"]],
    });

    const byRollNumber = new Map();
    for (const submission of submissions) {
      if (!byRollNumber.has(submission.std_rollno)) {
        byRollNumber.set(submission.std_rollno, submission);
      }
    }

    const describe = (student) => ({
      // The roll number, not the CNIC. The old code put std_cnic in this field,
      // so the screen displayed national ID numbers under a "Roll no" heading.
      std_rollno: student.std_rollno,
      std_cnic: student.std_cnic,
      std_name: student.user?.user_name || "Name unavailable",
      center_name: student.centers?.center_name || "Centre unavailable",
      course_name: student.courses?.course_name || "Course unavailable",
    });

    const submitted = [];
    const notSubmitted = [];

    for (const student of students) {
      const submission = byRollNumber.get(student.std_rollno);
      if (!submission) {
        notSubmitted.push(describe(student));
        continue;
      }

      submitted.push({
        ...describe(student),
        submission_date: submission.submitted_on,
        assignment_title: submission.Assignment?.as_title || assignment.as_title,
        total_marks: submission.Assignment?.as_marks ?? assignment.as_marks,
        obtained_marks: submission.obt_marks,
        status: submission.as_submission_status,
        submission_id: submission.as_submission_id,
        submission_attachment: submission.as_submission_attachment,
        submission_comment: submission.as_submission_comment,
        trainer_comments: submission.trainer_comments,
      });
    }

    const markedCount = submitted.filter(
      (row) => Number(row.status) === STATUS_MARKED
    ).length;

    return res.status(200).json({
      success: true,
      message: "Assignment submissions fetched successfully",
      data: {
        submitted,
        notSubmitted,
        totalStudents: students.length,
        submittedCount: submitted.length,
        pendingCount: notSubmitted.length,
        markedCount,
        awaitingMarking: submitted.length - markedCount,
        deadlinePassed: isPastDeadline(assignment.as_deadline),
      },
    });
  } catch (error) {
    console.error("Error in getAssignmentSubmissionsByBatch:", error);
    return res.status(500).json({
      success: false,
      message: "Could not load the submissions",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ---------------------------------------------------------------------------
// Marking
// ---------------------------------------------------------------------------

/**
 * Record a mark and feedback.
 *
 * This had NO authorisation of any kind. Any signed-in user could PUT to it
 * with a submission id and set their own marks and status - a student could
 * grade their own work, and nothing in the response would have looked unusual.
 *
 * Marks were also unchecked: the column is a STRING(5), so "abc" stored
 * happily and turned every average built from it into NaN, and a mark above
 * the assignment total produced percentages over 100.
 */
exports.updateAssignmentSubmission = async (req, res) => {
  try {
    const invalid = firstValidationError(req);
    if (invalid) {
      return res.status(400).json({ success: false, message: invalid });
    }

    const submissionId = req.params.as_id;

    const submission = await AssignmentSubmission.findByPk(submissionId);
    if (!submission) {
      return res
        .status(404)
        .json({ success: false, message: "That submission no longer exists" });
    }

    const assignment = await Assignment.findByPk(submission.as_id);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "The assignment for this submission no longer exists",
      });
    }

    const viewer = await resolveViewer(req.user, submission.tb_id);
    if (!canMarkSubmission(viewer, assignment)) {
      return res.status(403).json({
        success: false,
        message: "Only the trainer who set this assignment can mark it",
      });
    }

    const { trainer_comments, obt_marks, as_submission_status } = req.body;

    if (obt_marks !== undefined) {
      const problem = validateMark(obt_marks, assignment.as_marks);
      if (problem) {
        return res.status(400).json({ success: false, message: problem });
      }
    }

    const changes = {};
    if (trainer_comments !== undefined) changes.trainer_comments = trainer_comments;
    if (obt_marks !== undefined) {
      const text = String(obt_marks).trim();
      changes.obt_marks = text === "" ? null : text;
    }
    if (as_submission_status !== undefined) {
      changes.as_submission_status = Number(as_submission_status);
    } else if (changes.obt_marks) {
      // Awarding a mark IS marking it. Leaving the status untouched left
      // marked work sitting in the trainer's "awaiting marking" count forever.
      changes.as_submission_status = STATUS_MARKED;
    }

    if (Object.keys(changes).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Nothing was sent to change" });
    }

    await submission.update(changes);

    console.log(
      `[submission] ${submissionId} marked ${changes.obt_marks ?? "(unchanged)"}/${assignment.as_marks} by user ${req.user.id}`
    );

    return res.json({
      success: true,
      message: "Submission updated",
      assignmentSubmission: submission,
    });
  } catch (error) {
    console.error("Assignment submission update error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not update the submission",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
