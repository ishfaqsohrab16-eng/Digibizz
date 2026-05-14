const express = require("express");
const router = express.Router();
const trainerLeaveController = require("../controllers/trainerLeaveController");
const { isAdminAuthenticated } = require("../middleware/authMiddleware");
router.post(
  "/leaves",
  isAdminAuthenticated,
  trainerLeaveController.createLeave
);

router.get(
  "/leaves/:user_id/:tb_id",
  isAdminAuthenticated,
  trainerLeaveController.getAllLeaves
);
router.get(
  "/leaves-trainer_by_mt_ad/:user_id/:tb_id/:user_type",
  isAdminAuthenticated,
  trainerLeaveController.getAllLeavesAsMTOrAdmin
);
router.get(
  "/leaves/:id",
  isAdminAuthenticated,
  trainerLeaveController.getLeaveById
);

router.put(
  "/leaves/:id",
  isAdminAuthenticated,
  trainerLeaveController.updateLeave
);

router.delete(
  "/leaves/:id",
  isAdminAuthenticated,
  trainerLeaveController.deleteLeave
);

router.put(
  "/leaves-status/:tl_code",
  isAdminAuthenticated,
  trainerLeaveController.updateLeaveStatus
);

router.put(
  "/leaves-admin-status/:tl_code",
  isAdminAuthenticated,
  trainerLeaveController.updateLeaveAdminStatus
);

module.exports = router;
