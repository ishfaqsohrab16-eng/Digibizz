const express = require("express");
const router = express.Router();
const classAnnouncementsController = require("../controllers/classAnnouncementsController");
const { isAdminAuthenticated } = require("../middleware/authMiddleware");

// Create announcement
router.post(
  "/",
  isAdminAuthenticated,
  classAnnouncementsController.createAnnouncement
);

// Get announcements
router.get(
  "/",
  isAdminAuthenticated,
  classAnnouncementsController.getAnnouncements
);

// Update announcement
router.put(
  "/:id",
  isAdminAuthenticated,
  classAnnouncementsController.updateAnnouncement
);

// Delete announcement
router.delete(
  "/:id",
  isAdminAuthenticated,
  classAnnouncementsController.deleteAnnouncement
);

// Notify students
router.post(
  "/notify-students",
  isAdminAuthenticated,
  classAnnouncementsController.notifyStudents
);

module.exports = router;
