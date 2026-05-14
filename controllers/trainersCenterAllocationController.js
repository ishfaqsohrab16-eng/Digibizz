const TrainersCenterAllocationModel = require("../models/trainersCenterAllocationModel");
const TrainerModel = require("../models/trainersModel");
const Center = require("../models/center");
const TrainingBatch = require("../models/trainingBatcheModel");
const Course = require("../models/course");
// Get all allocations
exports.getAllAllocations = async (req, res) => {
  try {
    const allocations = await TrainersCenterAllocationModel.findAll({
      include: [
        { model: TrainerModel, as: "trainers" },
        { model: TrainingBatch, as: "training_batches" },
        { model: Center, as: "center" },
      ],
    });
    res.status(200).json({ success: true, data: allocations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get single allocation
exports.getAllocation = async (req, res) => {
  try {
    const allocation = await TrainersCenterAllocationModel.findByPk(
      req.params.id,
      {
        include: [
          { model: TrainerModel, as: "trainers" },
          { model: TrainingBatch, as: "training_batches" },
          { model: Center, as: "center" },
        ],
      }
    );

    if (!allocation) {
      return res
        .status(404)
        .json({ success: false, error: "Allocation not found" });
    }

    res.status(200).json({ success: true, data: allocation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create new allocation
exports.createAllocation = async (req, res) => {
  try {
    const { t_id, tb_id, t_center_id, t_course_id } = req.body;

    // Validate if related records exist
    const trainer = await TrainerModel.findByPk(t_id);
    const batch = await TrainingBatch.findByPk(tb_id);
    const center = await Center.findByPk(t_center_id);
    const course = await Course.findByPk(t_course_id);

    if (!trainer || !batch || !center || !course) {
      return res.status(400).json({
        success: false,
        error: "Invalid trainer, batch, center or course ID",
      });
    }

    // Map the fields to match the database column names
    const allocation = await TrainersCenterAllocationModel.create({
      t_id: t_id,
      tb_id: tb_id,
      center_id: t_center_id, // Changed from t_center_id
      course_id: t_course_id, // Changed from t_course_id
    });

    res.status(201).json({
      success: true,
      data: allocation,
      message: "Trainer allocation created successfully",
    });
  } catch (error) {
    console.error("Allocation Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.errors ? error.errors.map((e) => e.message) : [],
    });
  }
};

// Update allocation
exports.updateAllocation = async (req, res) => {
  try {
    const allocation = await TrainersCenterAllocationModel.findByPk(
      req.params.id
    );

    if (!allocation) {
      return res
        .status(404)
        .json({ success: false, error: "Allocation not found" });
    }

    // If updating relationships, validate they exist
    if (req.body.t_id) {
      const trainer = await TrainerModel.findByPk(req.body.t_id);
      if (!trainer) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid trainer ID" });
      }
    }

    if (req.body.tb_id) {
      const batch = await TrainingBatch.findByPk(req.body.tb_id);
      if (!batch) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid batch ID" });
      }
    }

    if (req.body.t_center_id) {
      const center = await Center.findByPk(req.body.t_center_id);
      if (!center) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid center ID" });
      }
    }

    await allocation.update(req.body);
    res.status(200).json({ success: true, data: allocation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Delete allocation
exports.deleteAllocation = async (req, res) => {
  try {
    const allocation = await TrainersCenterAllocationModel.findByPk(
      req.params.id
    );

    if (!allocation) {
      return res
        .status(404)
        .json({ success: false, error: "Allocation not found" });
    }

    await allocation.destroy();
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
