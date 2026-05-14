const express = require("express");
const router = express.Router();
const courseController = require("../controllers/courseController");
const { validateCourseCreation } = require("../middleware/courseValidation");

// Create Course
router.post("/", validateCourseCreation, courseController.createCourse);

// Get Course Profile
router.get("/:id", courseController.getCourseProfileById);
router.get("/", courseController.getAllCourses);
// Update Course
router.put("/:id", validateCourseCreation, courseController.updateCourse);

module.exports = router;
