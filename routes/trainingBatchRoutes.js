const express = require("express");
const router = express.Router();
const trainingBatchController = require("../controllers/trainingBatchController");
const {
  validateTrainingBatch,
} = require("../middleware/trainingBatchValidation");

// Create Training Batch
router.post(
  "/",
  validateTrainingBatch,
  trainingBatchController.createTrainingBatch
);

// Get All Training Batches
router.get("/", trainingBatchController.getAllTrainingBatches);

// Get Training Batch by ID
router.get("/:id", trainingBatchController.getTrainingBatchById);

// Update Training Batch
router.put(
  "/:id",
  validateTrainingBatch,
  trainingBatchController.updateTrainingBatch
);

module.exports = router;
