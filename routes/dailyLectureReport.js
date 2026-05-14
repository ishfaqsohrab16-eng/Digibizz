const express = require("express");
const router = express.Router();
const {
  createReport,
  getAllReports,
  getReportById,
  updateReport,
  deleteReport,
} = require("../controllers/dailyLectureReportController");
const { isAdminAuthenticated } = require("../middleware/authMiddleware");

router.post("/", isAdminAuthenticated, createReport);
router.get("/:tb_id/:t_id/:userType/:center_id/:course_id", isAdminAuthenticated, getAllReports);
router.get("/:id", isAdminAuthenticated, getReportById);
router.put("/:id", isAdminAuthenticated, updateReport);
router.delete("/:id", isAdminAuthenticated, deleteReport);

module.exports = router;
