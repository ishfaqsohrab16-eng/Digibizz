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

// Only the batches a trainer is actually allocated to. Declared before the
// "/:id" route below so it can never be swallowed by that single-segment match.
router.get(
  "/for-trainer/:user_id",
  trainingBatchController.getTrainingBatchesForTrainer
);

// Get Training Batch by ID
router.get("/:id", trainingBatchController.getTrainingBatchById);

// Update Training Batch
router.put(
  "/:id",
  validateTrainingBatch,
  trainingBatchController.updateTrainingBatch
);

module.exports = router;
