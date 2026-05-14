const express = require("express");
const router = express.Router();
const {
  createLectureRecording,
  getAllLectureRecordings,
  getLectureRecordingById,
  updateLectureRecording,
  deleteLectureRecording,
} = require("../controllers/lectureRecordingController");
const {upload} = require("../middleware/uploadsLectureRecording");
const {isAdminAuthenticated} = require("../middleware/authMiddleware");
// Create new lecture recording
router.post("/", isAdminAuthenticated, upload.single('lr_attachment'), createLectureRecording);

// Get all lecture recordings with optional filters
router.get("/", isAdminAuthenticated, getAllLectureRecordings);

// Get single lecture recording by ID
router.get("/:id", isAdminAuthenticated, getLectureRecordingById);

// Update lecture recording
router.put("/:id", isAdminAuthenticated, upload.single('lr_attachment'), updateLectureRecording);

// Delete lecture recording
router.delete("/:id", isAdminAuthenticated, deleteLectureRecording);

module.exports = router;
