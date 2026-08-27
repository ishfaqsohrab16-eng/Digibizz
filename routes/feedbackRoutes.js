const express = require("express");
const router = express.Router();
const {
  getAllFeedback,
  getFeedbackWindow,
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
// Whether the signed-in student may submit this week, so the form can say so
// before they fill it in.
router.get("/window", isAdminAuthenticated, getFeedbackWindow);
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
