const express = require("express");
const router = express.Router();
const studentsDocsController = require("../controllers/studentsDocsController"); // Adjust the path as necessary
const { isAdminAuthenticated } = require("../middleware/authMiddleware");
const { upload, handleUploadError } = require("../middleware/uploadsDoc");
// Get all student documents
router.get("/", isAdminAuthenticated, studentsDocsController.getAllStudentDocs);

// Get a single student document by ID
router.get(
  "/:id",
  isAdminAuthenticated,
  studentsDocsController.getStudentDocById
);

// Create a new student document
router.post(
  "/",
  isAdminAuthenticated,
  upload.single("student_docs"),
  handleUploadError,
  studentsDocsController.createStudentDoc
);

// Update a student document by ID
router.put(
  "/:id",
  isAdminAuthenticated,
  studentsDocsController.updateStudentDoc
);

// Delete a student document by ID
router.delete(
  "/:id",
  isAdminAuthenticated,
  studentsDocsController.deleteStudentDoc
);

module.exports = router;
