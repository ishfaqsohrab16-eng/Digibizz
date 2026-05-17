const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { isAdminAuthenticated } = require("../middleware/authMiddleware");
const {
  validatePasswordChange,
  validateUserLogin: validateAdminLogin,
} = require("../middleware/adminValidation");
const upload = require("../middleware/uploadConfig");

// Admin Registration with file upload
router.post(
  "/register",
  upload.single("profile_photo"), // Add this middleware
  adminController.registerAdmin
);
router.post(
  "/update-profile-photo",
  upload.single("profile_photo"),
  isAdminAuthenticated,
  adminController.updateProfilePhoto
);

// Admin Login (unchanged)
router.post("/login", validateAdminLogin, adminController.loginAdmin);
router.post("/login/:user_id/:tb_id",isAdminAuthenticated, validateAdminLogin, adminController.loginAsSubUser);
// Get Admin Profile (unchanged)
router.get("/profile", isAdminAuthenticated, adminController.getAdminsProfile);

// Update Admin Profile with file upload
router.put(
  "/profile",
  isAdminAuthenticated,
  upload.single("profile_photo"), // Add this middleware
  adminController.updateAdminProfile
);
router.post("/logout", (req, res) => {
  if (req.session) {
    req.session.destroy(() => {});
  }

  res.clearCookie("connect.sid", {
    httpOnly: true,
    sameSite: "none",
    secure: process.env.NODE_ENV === "production",
  });

  res.json({ message: "Logged out successfully" });
});
router.put(
  "/change-password",
  isAdminAuthenticated,
  validatePasswordChange,
  adminController.changeUserPassword
);
router.put("/change-student-password", adminController.changeUserPassword);

// Forgot Password
router.post("/forgot-password", adminController.forgotPassword);

// Reset Password
router.post("/reset-password", adminController.resetPassword);

module.exports = router;
