const express = require("express");
const router = express.Router();
const assignmentSubmissionController = require("../controllers/assignmentSubmissionController");
const { isAdminAuthenticated } = require("../middleware/authMiddleware");
const {
  validateAssignmentSubmissionCreation,

  validateAssignmentSubmissionUpdate,
} = require("../middleware/assignmentSubmissionValidation");
const { upload } = require("../middleware/uploadAssignmentConfig");

// Create Assignment Submission
router.post(
  "/",
  upload.single("assignment_attachment"),
  isAdminAuthenticated,
  validateAssignmentSubmissionCreation,
  assignmentSubmissionController.createAssignmentSubmission
);

// Get Assignment Submission by ID
router.get(
  "/:as_id/:std_rollno",
  isAdminAuthenticated,
  assignmentSubmissionController.getAssignmentSubmissionById
);

// Update Assignment Submission
router.put(
  "/:as_id",
  validateAssignmentSubmissionUpdate,
  isAdminAuthenticated,
  assignmentSubmissionController.updateAssignmentSubmission
);
router.get(
  "/getAssignmentSubmission/:tb_id/:user_id/:as_id",
  isAdminAuthenticated,
  assignmentSubmissionController.getAssignmentSubmissionsByBatch
);
module.exports = router;
