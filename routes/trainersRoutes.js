const express = require("express");
const router = express.Router();
const trainersController = require("../controllers/trainersController");
const {
  validateTrainerRegistration,
  validateTrainerLogin,
} = require("../middleware/trainersValidation");
const upload = require("../middleware/uploadConfig");
const { isAdminAuthenticated } = require("../middleware/authMiddleware");
// Register Trainer
router.post(
  "/register",
  upload.single("profile_photo"),
  validateTrainerRegistration,
  isAdminAuthenticated,
  trainersController.registerTrainer
);

// Get Trainer Profile
router.get(
  "/profile/:tb_id",
  isAdminAuthenticated,
  trainersController.getTrainerProfile
);
router.get(
  "/profile-user/:tb_id",
  isAdminAuthenticated,
  trainersController.getTrainerProfileByUserID
);
router.get(
  "/get-profile/:tb_id/:user_id",
  isAdminAuthenticated,
  trainersController.getTrainerProfileForFeedBack
);
router.get("/profile", isAdminAuthenticated, trainersController.getAllTrainers);

// Update Trainer Profile
router.put("/profile", trainersController.updateTrainerProfile);

module.exports = router;
