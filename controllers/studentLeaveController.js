const studentLeave = require("../models/studentLeaveModel");
const TrainingBatch = require("../models/trainingBatcheModel");
const Center = require("../models/center");
const Course = require("../models/course");
const User = require("../models/userModel");
const StudentModel = require("../models/studentModel");
const TrainerModel = require("../models/trainersModel");
const TrainerCenterAllocation = require("../models/trainersCenterAllocationModel");

const createLeave = async (req, res, next) => {
  try {
    const {
      sl_code,
      std_cnic,
      tb_id,
      course_id,
      center_id,
      sl_date,
      sl_month,
      sl_subject,
      sl_body,
      sl_submit_date,
    } = req.body;
    const maxLeavesAllowed = 3;
    // Check required fields
    if (
      !sl_code ||
      !std_cnic ||
      !tb_id ||
      !course_id ||
      !center_id ||
      !sl_date ||
      !sl_month ||
      !sl_subject ||
      !sl_body ||
      !sl_submit_date
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Validate foreign keys
    const trainingBatch = await TrainingBatch.findByPk(tb_id);
    const center = await Center.findByPk(course_id);
    const course = await Course.findByPk(center_id);

    if (!trainingBatch || !center || !course) {
      return res.status(404).json({ message: "Invalid foreign key reference" });
    }

    // Check existing leaves count
    const currentCount = await studentLeave.count({
      where: {
        std_cnic,
        sl_month,
      },
    });

    if (currentCount >= maxLeavesAllowed) {
      return res.status(400).json({
        message: `You have 0 leave(s) remaining in this month. We allow max. ${maxLeavesAllowed} leaves in a month.`,
      });
    }

    // Calculate remaining leaves
    const remainingLeaves = maxLeavesAllowed - currentCount;

    // Create the leave
    const newLeave = await studentLeave.create(req.body);

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
