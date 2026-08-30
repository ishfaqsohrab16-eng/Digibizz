const trainerLeave = require("../models/trainerLeaveModel");
const TrainingBatch = require("../models/trainingBatcheModel");
const Center = require("../models/center");
const Course = require("../models/course");
const Trainer = require("../models/trainersModel");
const MasterTrainer = require("../models/masterTrainersModel");
const TrainerCenterAllocation = require("../models/trainersCenterAllocationModel");
const Admin = require("../models/adminModel");
const User = require("../models/userModel");
const { withAllocationScope } = require("../utils/trainerScope");

const createLeave = async (req, res, next) => {
  try {
    const {
      tl_code,
      t_id,
      tb_id,
      course_id,
      center_id,
      tl_date,
      tl_month,
      tl_subject,
      tl_body,
      tl_submit_date,
      tl_mt_comments,
      tl_admin_comments,
    } = req.body;
    const maxLeavesAllowed = 2;
    if (
      !tl_code ||
      !t_id ||
      !tb_id ||
      !course_id ||
      !center_id ||
      !tl_date ||
      !tl_month ||
      !tl_subject ||
      !tl_body ||
      !tl_submit_date
    ) {
      return res.status(400).json({ message: `Missing required fields: ${tl_code}, ${t_id}, ${tb_id}, ${course_id}, ${center_id}, ${tl_date}, ${tl_month}, ${tl_subject}, ${tl_body}, ${tl_submit_date}` });
    }

    // Validate foreign keys
    const trainingBatch = await TrainingBatch.findByPk(tb_id);
    const center = await Center.findByPk(center_id);
    const course = await Course.findByPk(course_id);
    const trainer = await Trainer.findByPk(t_id);

    if (!trainingBatch) {
      return res
        .status(404)
        .json({ message: "Invalid trainingBatch foreign key reference" });
    }
    if (!center) {
      return res
        .status(404)
        .json({ message: "Invalid center foreign key reference" });
    }
    if (!course) {
      return res
        .status(404)
        .json({ message: "Invalid course foreign key reference" });
    }
    if (!trainer) {
      return res
        .status(404)
        .json({ message: "Invalid trainer foreign key reference" });
    }

    // Check existing leaves count
    const currentCount = await trainerLeave.count({
      where: {
        t_id,
        tl_month,
      },
    });

    if (currentCount >= maxLeavesAllowed - 1) {
      return res.status(400).json({
        message: `You have 0 leave(s) remaining in this month. We allow max. ${maxLeavesAllowed} leaves in a month.`,
      });
    }

    // Calculate remaining leaves
    const remainingLeaves = maxLeavesAllowed - currentCount;

    // Create the leave
    const newLeave = await trainerLeave.create({
      tl_code,
      t_id,
      tb_id,
      course_id,
      center_id,
      tl_date,
      tl_month,
      tl_subject,
      tl_body,
      tl_submit_date,
      tl_mt_comments,
      tl_admin_comments,
      tl_status: 0,
    });

    res.status(201).json({
      message: `Leave created successfully. You have ${remainingLeaves} leave(s) remaining in this month. We allow max. ${maxLeavesAllowed} leaves in a month.`,
      data: newLeave,
    });
  } catch (err) {
    next(err);
  }
};

const getAllLeaves = async (req, res, next) => {
  try {
    const { user_id, tb_id } = req.params;

    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }
    const Trainers = await Trainer.findOne({
      where: {
        user_id: user_id,
      },
    });
    const users = await User.findAll({
      where: {
        user_id: user_id,
      },
    });
    if (!Trainers) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Every (center, course) pair this trainer teaches, not just the first.
    // findOne() here is what made a trainer with more than one class see an
    // empty list while the dashboard - which counts across all allocations -
    // reported 2 pending leaves.
    const allocations = await TrainerCenterAllocation.findAll({
      where: {
        tb_id: tb_id,
        t_id: Trainers.t_id,
      },
    });

    // No allocations means "matches nothing", but that is a legitimately empty
    // list, not an error. A 404 here blanked the page for trainers who simply
    // had no class assigned yet.
    const scopedWhere = withAllocationScope(
      { tb_id: tb_id, t_id: Trainers.t_id },
      allocations
    );

    if (!scopedWhere) {
      return res.json({ data: [], userTrainer: users });
    }

    const leaves = await trainerLeave.findAll({
      where: scopedWhere,
      include: [
        { model: TrainingBatch, as: "training_batches" },
        { model: Trainer, as: "trainers" },
        { model: Center, as: "centers" },
        { model: Course, as: "courses" },
      ],
    });
    res.json({
      data: leaves,
      userTrainer: users,
    });
  } catch (err) {
    next(err);
  }
};
const getAllLeavesAsMTOrAdmin = async (req, res, next) => {
  try {
    const { user_id, tb_id, user_type } = req.params;

    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }
    let leave;
    if (user_type === "MasterTrainer") {
      const MTrainer = await MasterTrainer.findOne({
        where: {
          user_id: user_id,
        },
      });

      leave = await trainerLeave.findAll({
        where: {
          tb_id: tb_id,
          course_id: MTrainer.mt_course_id,
        },
        include: [
          { model: TrainingBatch, as: "training_batches" },
          { model: Center, as: "centers" },
          { model: Trainer, as: "trainers" },
          { model: Course, as: "courses" },
        ],
      });
    } else {
      leave = await trainerLeave.findAll({
        where: {
          tb_id: tb_id,
        },
        include: [
          { model: TrainingBatch, as: "training_batches" },
          { model: Center, as: "centers" },
          { model: Trainer, as: "trainers" },
          { model: Course, as: "courses" },
        ],
      });
    }
    let users = [];
    if (leave.length > 0) {
      const trainerIds = leave.map((l) => l.t_id);
      const trainers = await Trainer.findAll({
        where: { t_id: trainerIds },
      });

      const trainerUserIds = trainers.map((t) => t.user_id);
      users = await User.findAll({
        where: { user_id: trainerUserIds },
        attributes: ["user_id", "user_name", "user_email"],
      });
    }
    res.json({
      data: leave,
      userTrainer: users,
    });
  } catch (err) {
    next(err);
  }
};
const getLeaveById = async (req, res, next) => {
  try {
    const leave = await trainerLeave.findByPk(req.params.id, {
      include: [
        { model: TrainingBatch, as: "training_batches" },
        { model: Center, as: "centers" },
        { model: Course, as: "courses" },
        { model: Trainer, as: "trainers" },
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
    const leave = await trainerLeave.findByPk(req.params.id);
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
      const center = await Center.findByPk(req.body.course_id);
      if (!center)
        return res.status(404).json({ message: "Invalid Center ID" });
    }

    if (req.body.center_id) {
      const course = await Course.findByPk(req.body.center_id);
      if (!course)
        return res.status(404).json({ message: "Invalid Course ID" });
    }

    await leave.update(req.body);
    res.json(leave);
  } catch (err) {
    next(err);
  }
};

const deleteLeave = async (req, res, next) => {
  try {
    const leave = await trainerLeave.findByPk(req.params.id);
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
    const { tl_status, tl_mt_comments, tl_code } = req.body;

    if (!tl_status && !tl_mt_comments) {
      return res
        .status(400)
        .json({ message: "Must provide either status or comments to update" });
    }

    const leave = await trainerLeave.findOne({
      where: {
        tl_code: tl_code,
      },
    });
    if (!leave) {
      return res.status(404).json({ message: "Leave not found" });
    }
    const updateFields = {};
    if (tl_status !== undefined) updateFields.tl_status = tl_status;
    if (tl_mt_comments !== undefined)
      updateFields.tl_mt_comments = tl_mt_comments;

    await leave.update(updateFields);

    res.json({
      message: "Status and comments updated successfully",
      updatedFields: updateFields,
    });
  } catch (err) {
    next(err);
  }
};
const updateLeaveAdminStatus = async (req, res, next) => {
  try {
    const { tl_status, tl_admin_comments, tl_code } = req.body;
    if (!tl_status && !tl_admin_comments) {
      return res
        .status(400)
        .json({ message: "Must provide either status or comments to update" });
    }

    const leave = await trainerLeave.findOne({
      where: {
        tl_code: tl_code,
      },
    });
    if (!leave) {
      return res.status(404).json({ message: "Leave not found" });
    }
    const updateFields = {};
    if (tl_status !== undefined) updateFields.tl_status = tl_status;
    if (tl_admin_comments !== undefined)
      updateFields.tl_admin_comments = tl_admin_comments;

    await leave.update(updateFields);

    res.json({
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
  updateLeaveAdminStatus,
  getAllLeavesAsMTOrAdmin,
};
