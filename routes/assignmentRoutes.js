const express = require("express");
const router = express.Router();
const assignmentController = require("../controllers/assignmentController");
const {
  validateAssignmentCreation,
  validateAssignmentUpdate,
  validateAssignmentQuery,
} = require("../middleware/assignmentValidation");
const { isAdminAuthenticated } = require("../middleware/authMiddleware");
const {
  upload,
  handleUploadError,
} = require("../middleware/uploadAssignmentConfig");

// Create Assignment
router.post(
  "/",
  upload.single("assignment_attachment"),
  handleUploadError,
  assignmentController.createAssignment
);

// Get All Assignments
router.get(
  "/:tb_id",
  validateAssignmentQuery,
  assignmentController.getAllAssignmentsByTB
);

// Get Assignment by ID
router.get("/:id", assignmentController.getAssignmentById);

// Update Assignment
router.put(
  "/:as_id",
  upload.single("assignment_attachment"),
  validateAssignmentUpdate,
  assignmentController.updateAssignment
);

// Delete Assignment
router.delete("/:id", assignmentController.deleteAssignment);
module.exports = router;
