const express = require("express");
const router = express.Router();
const {
  getStudentDashoard,
  getTrainerDashoard,
  getMasterTrainerDashoard,
  getCenterUserDashboard,
} = require("../controllers/dashboarController");
const { isAdminAuthenticated } = require("../middleware/authMiddleware");
router.get(
  "/student/:user_id/:tb_id/:userType",
  isAdminAuthenticated,
  getStudentDashoard
);

router.get(
  "/trainer/:user_id/:tb_id/:userType",
  isAdminAuthenticated,
  getTrainerDashoard
);
router.get(
  "/master-trainer/:user_id/:tb_id/:userType",
  isAdminAuthenticated,
  getMasterTrainerDashoard
);
router.get(
  "/center-user/:user_id/:tb_id",
  isAdminAuthenticated,
  getCenterUserDashboard
);
module.exports = router;
