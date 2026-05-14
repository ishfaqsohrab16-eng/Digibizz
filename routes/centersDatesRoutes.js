const express = require("express");
const router = express.Router();
const centersDatesController = require("../controllers/centersDatesController");
const {
  validateCenterDateCreation,
} = require("../middleware/centersDatesValidation");

// Create Center Date
router.post(
  "/",
  validateCenterDateCreation,
  centersDatesController.createCenterDate
);

// Get Center Date
router.get("/:id", centersDatesController.getCenterDate);

// Update Center Date
router.put(
  "/:id",
  validateCenterDateCreation,
  centersDatesController.updateCenterDate
);

module.exports = router;
