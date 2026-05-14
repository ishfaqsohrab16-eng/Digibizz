const express = require("express");
const router = express.Router();
const trainerAttendanceController = require("../controllers/trainerAttendanceController");
const { isAdminAuthenticated } = require("../middleware/authMiddleware");

router.post(
  "/",
  isAdminAuthenticated,
  trainerAttendanceController.createAttendance
);

router.get(
  "/",
  isAdminAuthenticated,
  trainerAttendanceController.getAllAttendance
);

router.get(
  "/:id",
  isAdminAuthenticated,
  trainerAttendanceController.getAttendanceById
);

router.get(
  "/trainer/:t_id",
  isAdminAuthenticated,
  trainerAttendanceController.getAttendanceByTrainer
);
router.put(
  "/:id",
  isAdminAuthenticated,
  trainerAttendanceController.updateAttendance
);
router.delete(
  "/:id",
  isAdminAuthenticated,
  trainerAttendanceController.deleteAttendance
);

module.exports = router;
