const studentLeave = require("../models/studentLeaveModel");
const TrainingBatch = require("../models/trainingBatcheModel");
const Center = require("../models/center");
const Course = require("../models/course");
const User = require("../models/userModel");
const StudentModel = require("../models/studentModel");
const TrainerModel = require("../models/trainersModel");
const TrainerCenterAllocation = require("../models/trainersCenterAllocationModel");
const { monthKey, localDateKey } = require("../utils/weekKey");

const MAX_LEAVES_PER_MONTH = 3;
const MAX_SUBJECT = 255;
const MAX_BODY = 20000;

/** 12-digit code, retried on the astronomically unlikely collision. */
const generateLeaveCode = async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = String(
      Math.floor(Math.random() * 900000000000 + 100000000000)
    );
    const clash = await studentLeave.findOne({ where: { sl_code: code } });
    if (!clash) return code;
  }
  // Fall back to something that cannot collide rather than failing the request.
  return `L${Date.now()}`;
};

/**
 * File a leave application.
 *
 * Everything identifying the student - CNIC, batch, center, course - is read
 * from their own record via the authenticated token, never from the request
 * body. Previously the browser supplied all of it, which caused two problems:
 *
 *   1. The form filled those fields from a localStorage cache, so on a new
 *      device, after clearing site data, or before that cache was written, the
 *      values were empty and every submission failed with "Missing required
 *      fields". That is the error students were hitting.
 *   2. The whole body was passed to create(), so a crafted request could set
 *      sl_status and file a leave that was already approved - or file one in
 *      another student's name.
 */
const createLeave = async (req, res) => {
  try {
    const userId = req.user?.id || req.admin?.id;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Please sign in again" });
    }

    const student = await StudentModel.findOne({ where: { user_id: userId } });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "No student profile is linked to this account",
      });
    }

    const sl_date = String(req.body?.sl_date || "").trim();
    const sl_subject = String(req.body?.sl_subject || "").trim();
    const sl_body = String(req.body?.sl_body || "").trim();

    if (!sl_date) {
      return res
        .status(400)
        .json({ success: false, message: "Please choose the date of leave" });
    }
    if (!sl_subject) {
      return res
        .status(400)
        .json({ success: false, message: "Please enter a subject" });
    }
    // The body arrives as rich text, so an "empty" editor is often "<p></p>".
    if (!sl_body || !sl_body.replace(/<[^>]*>/g, "").trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Please describe the reason for leave" });
    }
    if (sl_subject.length > MAX_SUBJECT) {
      return res.status(400).json({
        success: false,
        message: `Keep the subject under ${MAX_SUBJECT} characters`,
      });
    }
    if (sl_body.length > MAX_BODY) {
      return res
        .status(400)
        .json({ success: false, message: "That reason is too long" });
    }

    const leaveDate = new Date(sl_date);
    if (Number.isNaN(leaveDate.getTime())) {
      return res
        .status(400)
        .json({ success: false, message: "That date is not valid" });
    }

    // Year-qualified ("2026-08") rather than a localised month name. The old
    // value was produced by the browser's locale, so the monthly cap counted
    // "August" from every year together - and broke entirely for a student
    // whose browser was not set to English.
    const month = monthKey(leaveDate);

    if (!student.tb_id || !student.center_id || !student.course_id) {
      return res.status(400).json({
        success: false,
        message:
          "Your enrolment is incomplete, so leave cannot be filed. Please contact your center manager.",
      });
    }

    // One application per date; the previous version allowed unlimited
    // duplicates for the same day.
    const duplicate = await studentLeave.findOne({
      where: { std_cnic: student.std_cnic, tb_id: student.tb_id, sl_date },
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "You have already applied for leave on that date",
      });
    }

    const used = await studentLeave.count({
      where: { std_cnic: student.std_cnic, sl_month: month },
    });

    if (used >= MAX_LEAVES_PER_MONTH) {
      return res.status(400).json({
        success: false,
        message: `You have used all ${MAX_LEAVES_PER_MONTH} leaves for this month.`,
      });
    }

    const newLeave = await studentLeave.create({
      sl_code: await generateLeaveCode(),
      std_cnic: student.std_cnic,
      tb_id: student.tb_id,
      center_id: student.center_id,
      course_id: student.course_id,
      sl_date,
      sl_month: month,
      sl_subject,
      sl_body,
      // Never taken from the request: a student must not be able to file a
      // leave that is already approved, or pre-fill the trainer's comment.
      sl_status: 0,
      sl_trainer_comments: "",
      sl_submit_date: localDateKey(),
    });

    // Counted AFTER the insert. The previous message used the pre-insert count,
    // so a student who had just used their first leave was told they still had
    // all three remaining.
    const remaining = Math.max(MAX_LEAVES_PER_MONTH - (used + 1), 0);

    return res.status(201).json({
      success: true,
      message: `Leave application submitted. You have ${remaining} leave(s) remaining this month.`,
      remaining,
      data: newLeave,
    });
  } catch (err) {
    // Previously this called next(err), which reached the global handler and
    // returned a raw Sequelize message as a 500 - unreadable to a student and
    // indistinguishable from a real outage.
    console.error("Create leave error:", err);
    if (err?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "That leave application already exists",
      });
    }
    return res.status(500).json({
      success: false,
      message: "Could not submit your leave application. Please try again.",
    });
  }
};

const getAllLeaves = async (req, res, next) => {
  try {
    const { user_id } = req.params;

    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }
    const Student = await StudentModel.findOne({
      where: {
        user_id: user_id,
      },
    });

    if (!Student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const leaves = await studentLeave.findAll({
      where: {
        std_cnic: Student.std_cnic,
      },
      include: [
        { model: TrainingBatch, as: "training_batches" },

        { model: Center, as: "centers" },
        { model: Course, as: "courses" },
      ],
    });
    res.json(leaves);
  } catch (err) {
    next(err);
  }
};
const getAllLeavesAsTrainer = async (req, res, next) => {
  try {
    const { user_id, tb_id } = req.params;

    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }
    const Trainer = await TrainerModel.findOne({
      where: {
        user_id: user_id,
      },
    });
    const TrainerCenterAllocations = await TrainerCenterAllocation.findOne({
      where: {
        tb_id: tb_id,
        t_id: Trainer.t_id,
      },
    });

    if (!TrainerCenterAllocations) {
      return res.status(404).json({ message: "Trainer not found" });
    }

    const leaves = await studentLeave.findAll({
      where: {
        tb_id: tb_id,
        course_id: TrainerCenterAllocations.course_id,
        center_id: TrainerCenterAllocations.center_id,
      },
      include: [
        { model: TrainingBatch, as: "training_batches" },

        { model: Center, as: "centers" },
        { model: Course, as: "courses" },
      ],
    });
    res.json(leaves);
  } catch (err) {
    next(err);
  }
};
const getLeaveById = async (req, res, next) => {
  try {
    const Student = await StudentModel.findByPk(req.params.user_id);
    const leave = await studentLeave.findOne({
      where: {
        std_cnic: Student.std_cnic,
      },
      include: [
        { model: TrainingBatch, as: "training_batches" },
        { model: Center, as: "centers" },
        { model: Course, as: "courses" },
      ],
    });

    if (!leave) {
      return res.status(404).json({ message: "Leave not found" });
    }
    res.json(leave);
  } catch (err) {
    next(err);
  }
};

const updateLeave = async (req, res, next) => {
  try {
    const leave = await studentLeave.findByPk(req.params.id);
    if (!leave) {
      return res.status(404).json({ message: "Leave not found" });
    }

    // Validate foreign keys if they're being updated
    if (req.body.tb_id) {
      const trainingBatch = await TrainingBatch.findByPk(req.body.tb_id);
      if (!trainingBatch)
        return res.status(404).json({ message: "Invalid Training Batch ID" });
    }

    if (req.body.course_id) {
      const course = await Course.findByPk(req.body.course_id);
      if (!course)
        return res.status(404).json({ message: "Invalid Course ID" });
    }

    if (req.body.center_id) {
      const center = await Center.findByPk(req.body.center_id);
      if (!center)
        return res.status(404).json({ message: "Invalid Center ID" });
    }

    await leave.update(req.body);
    res.json(leave);
  } catch (err) {
    next(err);
  }
};

const deleteLeave = async (req, res, next) => {
  try {
    const leave = await studentLeave.findByPk(req.params.id);
    if (!leave) {
      return res.status(404).json({ message: "Leave not found" });
    }

    await leave.destroy();
    res.json({ message: "Leave deleted successfully" });
  } catch (err) {
    next(err);
  }
};
const updateLeaveStatus = async (req, res, next) => {
  try {
    const { sl_status, sl_trainer_comments, sl_code } = req.body;

    if (!sl_status && !sl_trainer_comments) {
      return res
        .status(400)
        .json({ message: "Must provide either status or comments to update" });
    }

    const leave = await studentLeave.findOne({
      where: {
        sl_code: sl_code,
      },
    });
    if (!leave) {
      return res.status(404).json({ message: "Leave not found" });
    }
    const updateFields = {};
    if (sl_status !== undefined) updateFields.sl_status = sl_status;
    if (sl_trainer_comments !== undefined)
      updateFields.sl_trainer_comments = sl_trainer_comments;

    await leave.update(updateFields);

    res.json({
      success: true,
      message: "Status and comments updated successfully",
      updatedFields: updateFields,
    });
  } catch (err) {
    next(err);
  }
};
module.exports = {
  createLeave,
  getAllLeaves,
  getLeaveById,
  updateLeave,
  deleteLeave,
  updateLeaveStatus,
  getAllLeavesAsTrainer,
};
