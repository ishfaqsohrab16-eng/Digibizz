const express = require("express");
const router = express.Router();
const assignmentSubmissionController = require("../controllers/assignmentSubmissionController");
const { isAdminAuthenticated } = require("../middleware/authMiddleware");
const {
  validateAssignmentSubmissionCreation,
  validateAssignmentSubmissionUpdate,
} = require("../middleware/assignmentSubmissionValidation");
const {
  upload,
  handleUploadError,
} = require("../middleware/uploadAssignmentConfig");

/**
 * Assignment submissions.
 *
 * Authentication is applied to the whole router. It was previously listed per
 * route, which is how the upload on POST ended up running BEFORE it - multer
 * writes the file to disk as it parses the request, so an unauthenticated
 * caller could leave files behind and only then be refused.
 *
 * Roles are not gated here. Each of these is legitimately used by more than one
 * role, and who may do what depends on the row: a student may read their own
 * submission, the trainer who set the work may read and mark it. Those checks
 * live in the controller, where the row is in hand.
 */
router.use(isAdminAuthenticated);

// Hand in work. The student is taken from the token, never from the body.
router.post(
  "/",
  upload.single("assignment_attachment"),
  handleUploadError,
  validateAssignmentSubmissionCreation,
  assignmentSubmissionController.createAssignmentSubmission
);

router.get(
  "/:as_id/:std_rollno",
  assignmentSubmissionController.getAssignmentSubmissionById
);

// Marking. Restricted in the controller to the trainer who set the assignment.
router.put(
  "/:as_id",
  validateAssignmentSubmissionUpdate,
  assignmentSubmissionController.updateAssignmentSubmission
);

// The marking list for one assignment.
//
// `user_id` stays in the path so existing links keep working, but it is no
// longer read - the viewer comes from the token. Passing somebody else's id
// used to decide whose classes were listed.
router.get(
  "/getAssignmentSubmission/:tb_id/:user_id/:as_id",
  assignmentSubmissionController.getAssignmentSubmissionsByBatch
);

module.exports = router;
