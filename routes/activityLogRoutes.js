const express = require("express");
const router = express.Router();
const activityLogController = require("../controllers/activityLogController");
const {
  validateActivityLogCreation,
} = require("../middleware/activityLogValidation");
const { isAdminAuthenticated } = require("../middleware/authMiddleware");

// Create Activity Log
router.post(
  "/",
  isAdminAuthenticated,
  validateActivityLogCreation,
  activityLogController.createActivityLog
);

// Get All Activity Logs
router.get(
  "/all/:tb_id",
  isAdminAuthenticated,
  activityLogController.getAllActivityLogs
);

// Get Activity Logs by User
router.get("/:user_type/:user_id", activityLogController.getActivityLogsByUser);

module.exports = router;
