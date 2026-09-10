const express = require("express");
const router = express.Router();
const {
  createLearningResource,
  getAllLearningResources,
  getLearningResourceById,
  updateLearningResource,
  deleteLearningResource,
} = require("../controllers/learningResourceController");
const {
  upload,
  handleUploadError,
} = require("../middleware/uploadsLearningresurses");
const {isAdminAuthenticated} = require("../middleware/authMiddleware");
// Create new learning resource
router.post(
  "/",
  upload.single("ls_attachment"),
  handleUploadError,
  isAdminAuthenticated,
  createLearningResource
);

// Get all learning resources with optional filters
router.get("/",isAdminAuthenticated, getAllLearningResources);

// Get single learning resource by ID
router.get("/:id", isAdminAuthenticated, getLearningResourceById);

// Update learning resource
router.put(
  "/:id",
  upload.single("ls_attachment"),
  handleUploadError,
  isAdminAuthenticated,
  updateLearningResource
);

// Delete learning resource
router.delete("/:id", deleteLearningResource);

module.exports = router;
