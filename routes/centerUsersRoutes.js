const express = require("express");
const router = express.Router();
const centerUserController = require("../controllers/centerUsersController");
const {
  validateCenterUserRegistration,
  validateCenterUserLogin,
} = require("../middleware/centerUsersValidationMiddleware");
const { isAdminAuthenticated } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadConfig");

// Register Center User
router.post(
  "/register",
  upload.single("profile_photo"),
  validateCenterUserRegistration,
  centerUserController.registerCenterUser
);

// Login Center User
router.post(
  "/login",
  validateCenterUserLogin,
  centerUserController.loginCenterUser
);

// Get Center User Profile
router.get(
  "/profile",
  isAdminAuthenticated,
  centerUserController.getCenterUserProfile
);

// Get Center User Profile by User ID
router.get(
  "/profile/:user_id",
  isAdminAuthenticated,
  centerUserController.getCenterUserProfileByUserId
);

// Update Center User Profile
router.put("/profile", centerUserController.updateCenterUserProfile);

module.exports = router;
