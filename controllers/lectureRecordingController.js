const LectureRecording = require("../models/lectureRecordingModel");
const Trainer = require("../models/trainersModel");
const TrainingBatch = require("../models/trainingBatcheModel");
const Center = require("../models/center");
const Course = require("../models/course");
const TrainerAlocation = require("../models/trainersCenterAllocationModel");
const MasterTrainer = require("../models/masterTrainersModel");
const { validationResult } = require("express-validator");
const { get } = require("../routes/learningResourceRoutes");
const { sequelize } = require("../config/db");
// Create Lecture Recording
exports.createLectureRecording = async (req, res) => {
  const errors = validationResult(req.body);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const trainer = await Trainer.findOne({
      where: {
        user_id: req.body.t_id,
      },
    });
    if (!trainer) {
      return res
        .status(404)
        .json({ success: false, message: "Trainer not found" });
    }
    const getTrainer = await TrainerAlocation.findAll({
      where: {
        tb_id: req.body.tb_id,
        t_id: trainer.t_id,
      },
    });
    if (!getTrainer) {
      return res
        .status(404)
        .json({ success: false, message: "Trainer Allocation not found" });
    }
    const user_profile_photo = req.file
      ? `/uploads/user-lecture-recording/${req.file.filename}`
      : null;
    const createdlectureRecording = [];
    const result = await sequelize.transaction(async (t) => {
      for (const trainerAllocations of getTrainer) {
        const lectureRecording = await LectureRecording.create({
          ...req.body,
          lr_added_on: new Date().toISOString().split("T")[0],
          t_id: trainerAllocations.t_id,
          lr_attachment: user_profile_photo,
          center_id: trainerAllocations.center_id,
          course_id: trainerAllocations.course_id,
        });
        createdlectureRecording.push(lectureRecording);
      }
      return createdlectureRecording;
    });
    res.status(201).json({
      success: true,
      message: "Lecture recording created successfully",
      data: createdlectureRecording,
    });
  } catch (error) {
    console.error("Lecture recording creation error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get All Lecture Recordings
exports.getAllLectureRecordings = async (req, res) => {
  try {
    const { tb_id, center_id, course_id, t_id, userType } = req.query;

    // Build query conditions - simplified approach
    const whereClause = {};
    if (tb_id) whereClause.tb_id = tb_id;
    if (center_id > 0) whereClause.center_id = center_id;
    if (course_id > 0) whereClause.course_id = course_id;
    if (userType === "trainer") {
      const trainer = await Trainer.findOne({
        where: {
          user_id: t_id,
        },
      });
      if (!trainer) {
        return res
          .status(404)
          .json({ success: false, message: "Trainer not found" });
      } else {
        if (trainer.t_id) whereClause.t_id = trainer.t_id;
      }
    }
    if (userType === "MasterTrainer") {
      const mt = await MasterTrainer.findOne({
        where: {
          user_id: t_id,
        },
      });
      if (!mt) {
        return res
          .status(404)
          .json({ success: false, message: "Master Trainer not found" });
      }
      whereClause.course_id = mt.mt_course_id;
    }
    const lectureRecordings = await LectureRecording.findAll({
      where: whereClause,
      include: [
        { model: Trainer, as: "trainers", attributes: ["t_id", "user_id"] },
        {
          model: TrainingBatch,
          as: "training_batches",
          attributes: ["tb_id", "tb_name"],
        },
        {
          model: Center,
          as: "centers",
          attributes: ["center_id", "center_name"],
        },
        {
          model: Course,
          as: "courses",
          attributes: ["course_id", "course_name"],
        },
      ],
      order: [["lr_date", "DESC"]],
    });

    res.status(200).json({ success: true, data: lectureRecordings });
  } catch (error) {
    console.error("Get lecture recordings error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Lecture Recording By ID
exports.getLectureRecordingById = async (req, res) => {
  try {
    const lectureRecording = await LectureRecording.findByPk(req.params.id, {
      include: [
        { model: Trainer, as: "trainer" },
        { model: TrainingBatch, as: "training_batch" },
        { model: Center, as: "center" },
        { model: Course, as: "course" },
      ],
    });

    if (!lectureRecording) {
      return res.status(404).json({
        success: false,
        message: "Lecture recording not found",
      });
    }

    res.status(200).json({ success: true, data: lectureRecording });
  } catch (error) {
    console.error("Get lecture recording error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Lecture Recording
exports.updateLectureRecording = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const lectureRecording = await LectureRecording.findByPk(req.params.id);
    if (!lectureRecording) {
      return res.status(404).json({
        success: false,
        message: "Lecture recording not found",
      });
    }

    await lectureRecording.update(req.body);
    res.status(200).json({
      success: true,
      message: "Lecture recording updated successfully",
      data: lectureRecording,
    });
  } catch (error) {
    console.error("Update lecture recording error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Lecture Recording
exports.deleteLectureRecording = async (req, res) => {
  try {
    const lectureRecording = await LectureRecording.findByPk(req.params.id);
    if (!lectureRecording) {
      return res.status(404).json({
        success: false,
        message: "Lecture recording not found",
      });
    }

    await lectureRecording.destroy();
    res.status(200).json({
      success: true,
      message: "Lecture recording deleted successfully",
    });
  } catch (error) {
    console.error("Delete lecture recording error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
