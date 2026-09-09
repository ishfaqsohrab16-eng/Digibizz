const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const {
  isAdminAuthenticated,
  requireRoles,
  ROLES,
} = require("../middleware/authMiddleware");
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
// Setting somebody else's password without knowing their old one is the
// strongest thing an account can do to another account, so it is the Super
// Admin's alone - the same line already drawn around reviewing M&E reports
// and purging a student.
router.put(
  "/reset-student-password",
  isAdminAuthenticated,
  requireRoles(ROLES.SUPER_ADMIN),
  adminController.resetStudentPasswordByAdmin
);
router.get(
  "/app-settings",
  isAdminAuthenticated,
  adminController.getAppSettings
);
router.put(
  "/app-settings",
  isAdminAuthenticated,
  adminController.updateAppSettings
);

// Forgot Password
router.post("/forgot-password", adminController.forgotPassword);

// Reset Password
router.post("/reset-password", adminController.resetPassword);

module.exports = router;
