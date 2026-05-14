const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/attendanceController");
const {
  validateAttendanceCreation,
  validateBulkAttendanceCreation,
  validateAttendanceUpdate,
  validateAttendanceQuery,
} = require("../middleware/attendanceValidation");
const { isAdminAuthenticated } = require("../middleware/authMiddleware");

// Create Single Attendance Record
router.post(
  "/studentAttendance",
  isAdminAuthenticated,
  attendanceController.createAttendance
);

// Create Bulk Attendance Records
router.post(
  "/studentAttendance/bulk",
  isAdminAuthenticated,
  attendanceController.bulkCreateAttendance
);

// Get Attendance Records
router.get(
  "/studentAttendance",
  isAdminAuthenticated,
  attendanceController.getAttendance
);
router.get(
  "/studentAttendancehstory",
  isAdminAuthenticated,
  attendanceController.getAttendanceHistory
);
// Get Attendance Summary
router.get(
  "/summary",
  isAdminAuthenticated,
  attendanceController.getAttendanceSummary
);

// Update Attendance Record
router.put("/:id", attendanceController.updateAttendance);

// Delete Attendance Record
router.delete("/:id", attendanceController.deleteAttendance);

module.exports = router;
