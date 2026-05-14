const express = require("express");
const router = express.Router();
const masterTrainersController = require("../controllers/masterTrainersController");
const {
  validateMasterTrainerRegistration,
  validateMasterTrainerLogin,
} = require("../middleware/masterTrainersValidation");
const upload = require("../middleware/uploadConfig");
const { isAdminAuthenticated } = require("../middleware/authMiddleware");
// Register Master Trainer
router.post(
  "/register",
  upload.single("profile_photo"),
  validateMasterTrainerRegistration,
  masterTrainersController.registerMasterTrainer
);

// Get Master Trainer Profile
router.get(
  "/profile",
  isAdminAuthenticated,
  masterTrainersController.getMasterTrainerProfile
);

// Update Master Trainer Profile
router.put("/profile", masterTrainersController.updateMasterTrainerProfile);

module.exports = router;
