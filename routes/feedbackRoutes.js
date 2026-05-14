const express = require("express");
const router = express.Router();
const {
  getAllFeedback,
  createFeedback,
  updateFeedback,
  deleteFeedback,
  getFeedbackByTbId,
  getFeedbackByTbIdCenterIdCourseId,
  getFeedbackForTrainer,
  getAllFeedBacks,
} = require("../controllers/feedbackController");
const { isAdminAuthenticated } = require("../middleware/authMiddleware");
router.get("/", isAdminAuthenticated, getAllFeedback);
router.post("/", isAdminAuthenticated, createFeedback);
router.put("/:id", isAdminAuthenticated, updateFeedback);
router.delete("/:id", isAdminAuthenticated, deleteFeedback);
router.get("/tb/:tb_id", isAdminAuthenticated, getFeedbackByTbId);
router.get(
  "/tb/:tb_id/center/:center_id/course/:course_id",
  isAdminAuthenticated,
  getFeedbackByTbIdCenterIdCourseId
);
router.get(
  "/tb/:tb_id/trainer/:user_id",
  isAdminAuthenticated,
  getFeedbackForTrainer
);
router.get("/:tb_id/:user_id/:userType", isAdminAuthenticated, getAllFeedBacks);

module.exports = router;
