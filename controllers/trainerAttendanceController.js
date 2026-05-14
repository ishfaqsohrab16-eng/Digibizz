const { validationResult } = require("express-validator");

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

    const existingAttendance = await TrainerAttendanceModel.findOne({
      where: {
        t_id: req.body.t_id,
        ta_date: req.body.ta_date,
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
    const attendance = await TrainerAttendanceModel.findAll({
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

    await attendance.update(req.body);

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
