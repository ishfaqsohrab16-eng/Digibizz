const express = require("express");
const router = express.Router();
const trainerTopicReportController = require("../controllers/trainerTopicReportController");
const {isAdminAuthenticated} = require("../middleware/authMiddleware");
// GET /api/trainer-topic-reports - Get all reports
router.get("/", isAdminAuthenticated, trainerTopicReportController.listReports);

// GET /api/trainer-topic-reports/:id - Get specific report
router.get("/:id", isAdminAuthenticated, trainerTopicReportController.getReport);

// POST /api/trainer-topic-reports - Create new report
router.post("/", isAdminAuthenticated, trainerTopicReportController.createReport);

// POST /api/trainer-topic-reports/mark-completed - Mark topic as completed
router.post("/mark-completed", isAdminAuthenticated, trainerTopicReportController.markTopicCompleted);

// PUT /api/trainer-topic-reports/:id - Update report
router.put("/:id", isAdminAuthenticated, trainerTopicReportController.updateReport);

// DELETE /api/trainer-topic-reports/:id - Delete report
router.delete("/:id", isAdminAuthenticated, trainerTopicReportController.deleteReport);

module.exports = router;
