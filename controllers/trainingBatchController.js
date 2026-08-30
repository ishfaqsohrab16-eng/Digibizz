const TrainingBatch = require("../models/trainingBatcheModel");
const { validationResult } = require("express-validator");
const { Op } = require("sequelize");
const Trainer = require("../models/trainersModel");
const TrainerCenterAllocation = require("../models/trainersCenterAllocationModel");

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

/**
 * The batches one trainer actually teaches in.
 *
 * The sidebar used to derive a trainer's batch list by POSITION - take the
 * index of the currently selected batch in the full list and offer that entry
 * plus its neighbour. That has nothing to do with what the trainer is assigned
 * to, so creating a new batch immediately offered it to every trainer, and
 * selecting it produced a dashboard with no allocations behind it. It also
 * showed nothing at all when the trainer's batch happened to sit at index 0.
 *
 * Allocations are the only real answer, so they are the source here.
 */
exports.getTrainingBatchesForTrainer = async (req, res) => {
  try {
    const { user_id } = req.params;

    const trainer = await Trainer.findOne({ where: { user_id } });

    // No trainer profile means no allocations, which is an empty list rather
    // than an error - the sidebar simply has nothing to offer.
    if (!trainer) {
      return res.status(200).json({ success: true, data: [] });
    }

    const allocations = await TrainerCenterAllocation.findAll({
      where: { t_id: trainer.t_id },
      attributes: ["tb_id"],
      group: ["tb_id"],
    });

    const batchIds = [...new Set(allocations.map((a) => a.tb_id))].filter(
      (id) => id !== null && id !== undefined
    );

    if (!batchIds.length) {
      return res.status(200).json({ success: true, data: [] });
    }

    const trainingBatches = await TrainingBatch.findAll({
      where: { tb_id: { [Op.in]: batchIds } },
      order: [["tb_id", "DESC"]],
    });

    // Dates are formatted exactly as getAllTrainingBatches does, so the sidebar
    // can consume either response interchangeably. Guarded because tb_start /
    // tb_end are nullable and .toISOString() on null throws.
    const formattedBatches = trainingBatches.map((batch) => ({
      ...batch.toJSON(),
      tb_start: batch.tb_start
        ? new Date(batch.tb_start).toISOString().split("T")[0]
        : null,
      tb_end: batch.tb_end
        ? new Date(batch.tb_end).toISOString().split("T")[0]
        : null,
    }));

    return res.status(200).json({ success: true, data: formattedBatches });
  } catch (error) {
    console.error("Fetching trainer training batches error:", error);
    return res
      .status(500)
      .json({ message: "Server error fetching training batches" });
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
