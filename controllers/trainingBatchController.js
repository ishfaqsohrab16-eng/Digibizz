const TrainingBatch = require("../models/trainingBatcheModel");
const { validationResult } = require("express-validator");

// Create Training Batch
exports.createTrainingBatch = async (req, res) => {
  // Validate input
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { tb_name, tb_slug, tb_descrip, tb_start, tb_end, tb_status } =
      req.body;

    const newTrainingBatch = await TrainingBatch.create({
      tb_name,
      tb_slug,
      tb_descrip,
      tb_start,
      tb_end,
      tb_status: tb_status || 0,
    });

    res.status(201).json({
      message: "Training Batch created successfully",
      trainingBatch: newTrainingBatch,
    });
  } catch (error) {
    console.error("Training Batch creation error:", error);
    res
      .status(500)
      .json({ message: "Server error during training batch creation" });
  }
};

// Get All Training Batches
exports.getAllTrainingBatches = async (req, res) => {
  try {
    const trainingBatches = await TrainingBatch.findAll();

    // Format dates to show only YYYY-MM-DD
    const formattedBatches = trainingBatches.map((batch) => ({
      ...batch.toJSON(),
      tb_start: batch.tb_start.toISOString().split("T")[0], // Format to YYYY-MM-DD
      tb_end: batch.tb_end.toISOString().split("T")[0],
    }));

    return res.status(200).json({
      success: true,
      data: formattedBatches,
    });
  } catch (error) {
    console.error("Fetching training batches error:", error);
    res.status(500).json({ message: "Server error fetching training batches" });
  }
};

// Get Training Batch by ID
exports.getTrainingBatchById = async (req, res) => {
  try {
    const { id } = req.params;
    const trainingBatch = await TrainingBatch.findByPk(id);

    if (!trainingBatch) {
      return res.status(404).json({ message: "Training Batch not found" });
    }

    res.json(trainingBatch);
  } catch (error) {
    console.error("Fetching training batch error:", error);
    res.status(500).json({ message: "Server error fetching training batch" });
  }
};

// Update Training Batch
exports.updateTrainingBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const { tb_name, tb_slug, tb_descrip, tb_start, tb_end, tb_status } =
      req.body;

    const [updatedRowsCount] = await TrainingBatch.update(
      { tb_name, tb_slug, tb_descrip, tb_start, tb_end, tb_status },
      { where: { tb_id: id } }
    );

    if (updatedRowsCount === 0) {
      return res.status(404).json({ message: "Training Batch not found" });
    }

    const updatedTrainingBatch = await TrainingBatch.findByPk(id);

    res.json({
      message: "Training Batch updated successfully",
      trainingBatch: updatedTrainingBatch,
    });
  } catch (error) {
    console.error("Training Batch update error:", error);
    res.status(500).json({ message: "Server error updating training batch" });
  }
};
