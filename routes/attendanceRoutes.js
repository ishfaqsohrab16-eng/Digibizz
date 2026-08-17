const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/attendanceController");
const {
  isAdminAuthenticated,
  requireRoles,
  ROLES,
  ATTENDANCE_MARKER_ROLES,
  ATTENDANCE_VIEWER_ROLES,
} = require("../middleware/authMiddleware");

// Every route below requires a valid token. isAdminAuthenticated only proves
// *who* you are - requireRoles proves you are allowed to be here. Without the
// role guard a student's token was accepted on every one of these endpoints.
router.use(isAdminAuthenticated);

// --- Recording attendance (staff only) -------------------------------------
router.post(
  "/studentAttendance",
  requireRoles(ATTENDANCE_MARKER_ROLES),
  attendanceController.createAttendance
);

router.post(
  "/studentAttendance/bulk",
  requireRoles(ATTENDANCE_MARKER_ROLES),
  attendanceController.bulkCreateAttendance
);

// --- Reading attendance (staff only) ---------------------------------------
router.get(
  "/studentAttendance",
  requireRoles(ATTENDANCE_VIEWER_ROLES),
  attendanceController.getAttendance
);

router.get(
  "/studentAttendancehstory",
  requireRoles(ATTENDANCE_VIEWER_ROLES),
  attendanceController.getAttendanceHistory
);

router.get(
  "/summary",
  requireRoles(ATTENDANCE_VIEWER_ROLES),
  attendanceController.getAttendanceSummary
);

// --- Individual student calendar -------------------------------------------
// Students are allowed here: the controller forces them to their own record and
// ignores any std_cnic they send.
router.get(
  "/student-calendar",
  requireRoles([...ATTENDANCE_VIEWER_ROLES, ROLES.STUDENT]),
  attendanceController.getStudentAttendanceCalendar
);

// --- Correcting attendance (staff only) ------------------------------------
// These two previously had NO authentication at all: any unauthenticated
// request could rewrite or delete any attendance record.
router.put(
  "/:id",
  requireRoles(ATTENDANCE_MARKER_ROLES),
  attendanceController.updateAttendance
);

router.delete(
  "/:id",
  requireRoles(ROLES.SUPER_ADMIN, ROLES.CONTENT_ADMIN),
  attendanceController.deleteAttendance
);

module.exports = router;
