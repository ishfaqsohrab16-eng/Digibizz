const { validationResult } = require("express-validator");
const { Op } = require("sequelize");

const TrainerAttendanceModel = require("../models/trainerAttendanceModel.js");
exports.createAttendance = async (req, res) => {
  try {
    // Validate required fields
    const requiredFields = ["cu_id", "t_id", "tb_id", "center_id", "ta_date"];
    const missingFields = requiredFields.filter((field) => !req.body[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    // Scope the duplicate check to the batch and center as well. Keying on
    // trainer + date alone blocked a trainer who legitimately teaches at two
    // centers on the same day, even though center_id is a required field.
    const existingAttendance = await TrainerAttendanceModel.findOne({
      where: {
        t_id: req.body.t_id,
        ta_date: req.body.ta_date,
        tb_id: req.body.tb_id,
        center_id: req.body.center_id,
      },
    });

    if (existingAttendance) {
      return res.status(409).json({
        success: false,
        message: "Attendance already marked for this date",
      });
    }

    const attendance = await TrainerAttendanceModel.create(req.body);

    return res.status(201).json({
      success: true,
      data: attendance,
    });
  } catch (error) {
    console.error("Error creating trainer attendance:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while creating attendance",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get all attendance records
exports.getAllAttendance = async (req, res) => {
  try {
    // Previously returned every trainer-attendance row ever recorded, for all
    // batches and centers, with no filter or limit.
    const { tb_id, center_id, t_id, from, to } = req.query;

    const where = {};
    if (tb_id) where.tb_id = tb_id;
    if (center_id) where.center_id = center_id;
    if (t_id) where.t_id = t_id;
    if (from && to) where.ta_date = { [Op.between]: [from, to] };
    else if (from) where.ta_date = { [Op.gte]: from };
    else if (to) where.ta_date = { [Op.lte]: to };

    const attendance = await TrainerAttendanceModel.findAll({
      where,
      include: ["TrainingBatch", "Center", "Trainer", "Course"],
      order: [["ta_date", "DESC"]],
      limit: Math.min(Number(req.query.limit) || 500, 1000),
    });

    res.status(200).json({
      success: true,
      data: attendance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get attendance by ID
exports.getAttendanceById = async (req, res) => {
  try {
    const { id } = req.params;
    const attendance = await TrainerAttendanceModel.findByPk(id, {
      include: ["TrainingBatch", "Center", "Trainer", "Course"],
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    res.status(200).json({
      success: true,
      data: attendance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get attendance by trainer ID
exports.getAttendanceByTrainer = async (req, res) => {
  try {
    const { t_id } = req.params;
    const attendance = await TrainerAttendanceModel.findAll({
      where: { t_id },
      include: ["TrainingBatch", "Center", "Trainer", "Course"],
    });

    res.status(200).json({
      success: true,
      data: attendance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update attendance
exports.updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const attendance = await TrainerAttendanceModel.findByPk(id);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    // Only the check-in/check-out times may be corrected. Passing req.body
    // straight through let a caller rewrite t_id, center_id, tb_id or ta_date,
    // i.e. re-attribute an attendance record to a different trainer or day.
    const editable = {};
    if (req.body.checkin_time !== undefined) editable.checkin_time = req.body.checkin_time;
    if (req.body.checkout_time !== undefined) editable.checkout_time = req.body.checkout_time;

    if (Object.keys(editable).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Nothing to update: provide checkin_time and/or checkout_time",
      });
    }

    await attendance.update(editable);

    res.status(200).json({
      success: true,
      data: attendance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete attendance
exports.deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const attendance = await TrainerAttendanceModel.findByPk(id);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    await attendance.destroy();

    res.status(200).json({
      success: true,
      message: "Attendance record deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
