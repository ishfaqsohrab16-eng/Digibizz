const LearningResource = require("../models/learningResourceModel");
const Trainer = require("../models/trainersModel");
const TrainingBatch = require("../models/trainingBatcheModel");
const Center = require("../models/center");
const Course = require("../models/course");
const TrainerAlocation = require("../models/trainersCenterAllocationModel");
const MasterTrainer = require("../models/masterTrainersModel");
const { sequelize } = require("../config/db");
const { validationResult } = require("express-validator");

// Create Learning Resource
exports.createLearningResource = async (req, res) => {
  const errors = validationResult(req);
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
        .json({ success: false, message: "Trainer not found" });
    }

    const attachment_path = req.file
      ? `/uploads/user-learning-resurses/${req.file.filename}`
      : null;
    const createLearningResource = [];

    const result = await sequelize.transaction(async (t) => {
      for (const trainerAllocations of getTrainer) {
        const learningResource = await LearningResource.create({
          ...req.body,
          ls_attachment: attachment_path,
          t_id: trainerAllocations.t_id,
          ls_added_on: new Date().toISOString().split("T")[0],
          center_id: trainerAllocations.center_id,
          course_id: trainerAllocations.course_id,
        });
        createLearningResource.push(learningResource);
      }
      return createLearningResource;
    });
    res.status(201).json({
      success: true,
      message: "Learning resource created successfully",
      data: createLearningResource,
    });
  } catch (error) {
    console.error("Learning resource creation error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get All Learning Resources
exports.getAllLearningResources = async (req, res) => {
  try {
    const { tb_id, center_id, course_id, t_id, userType } = req.query;

    // Build query conditions
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
    const learningResources = await LearningResource.findAll({
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
      order: [["ls_added_on", "DESC"]],
    });

    res.status(200).json({ success: true, data: learningResources });
  } catch (error) {
    console.error("Get learning resources error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Learning Resource By ID
exports.getLearningResourceById = async (req, res) => {
  try {
    const learningResource = await LearningResource.findByPk(req.params.id, {
      include: [
        { model: Trainer, as: "trainer" },
        { model: TrainingBatch, as: "training_batch" },
        { model: Center, as: "center" },
        { model: Course, as: "course" },
      ],
    });

    if (!learningResource) {
      return res.status(404).json({
        success: false,
        message: "Learning resource not found",
      });
    }

    res.status(200).json({ success: true, data: learningResource });
  } catch (error) {
    console.error("Get learning resource error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Learning Resource
exports.updateLearningResource = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const learningResource = await LearningResource.findByPk(req.params.id);
    if (!learningResource) {
      return res.status(404).json({
        success: false,
        message: "Learning resource not found",
      });
    }

    // Handle file upload if present
    const updateData = { ...req.body };

    if (req.file) {
      updateData.ls_attachment = `/uploads/user-learning-resurses/${req.file.filename}`;
    }

    await learningResource.update(updateData);
    res.status(200).json({
      success: true,
      message: "Learning resource updated successfully",
      data: learningResource,
    });
  } catch (error) {
    console.error("Update learning resource error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Learning Resource
exports.deleteLearningResource = async (req, res) => {
  try {
    const learningResource = await LearningResource.findByPk(req.params.id);
    if (!learningResource) {
      return res.status(404).json({
        success: false,
        message: "Learning resource not found",
      });
    }

    await learningResource.destroy();
    res.status(200).json({
      success: true,
      message: "Learning resource deleted successfully",
    });
  } catch (error) {
    console.error("Delete learning resource error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
