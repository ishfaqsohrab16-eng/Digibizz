const express = require("express");
const router = express.Router();
const studentLeaveController = require("../controllers/studentLeaveController");
const { isAdminAuthenticated } = require("../middleware/authMiddleware");
router.post(
  "/leaves",
  isAdminAuthenticated,
  studentLeaveController.createLeave
);

router.get(
  "/leaves/:user_id",
  isAdminAuthenticated,
  studentLeaveController.getAllLeaves
);

router.get(
  "/leaves-trainer/:user_id/:tb_id",
  isAdminAuthenticated,
  studentLeaveController.getAllLeavesAsTrainer
);

// Distinct path from "/leaves/:user_id". Both were registered as a single
// dynamic segment on the same path, so this one was unreachable - every
// request matched getAllLeaves above and getLeaveById never ran.
router.get(
  "/leave/:id",
  isAdminAuthenticated,
  studentLeaveController.getLeaveById
);

router.put(
  "/leaves/:id",
  isAdminAuthenticated,
  studentLeaveController.updateLeave
);

router.delete(
  "/leaves/:id",
  isAdminAuthenticated,
  studentLeaveController.deleteLeave
);

router.put(
  "/leaves-status/:sl_code",
  isAdminAuthenticated,
  studentLeaveController.updateLeaveStatus
);

module.exports = router;
