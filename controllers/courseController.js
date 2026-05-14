const Course = require("../models/course");
const { validationResult } = require("express-validator");

// Create Course
exports.createCourse = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { course_name, course_full_name, course_status } = req.body;

    // Check if course already exists
    const existingCourse = await Course.findOne({
      where: { course_name },
    });

    if (existingCourse) {
      return res.status(400).json({ message: "Course already exists" });
    }

    // Create new course
    const newCourse = await Course.create({
      course_name,
      course_full_name,
      course_status: course_status || 1,
    });

    res.status(201).json({
      message: "Course created successfully",
      course: {
        id: newCourse.course_id,
        name: newCourse.course_name,
        fullName: newCourse.course_full_name,
        status: newCourse.course_status,
      },
    });
  } catch (error) {
    console.error("Course creation error:", error);
    res.status(500).json({ message: "Server error during course creation" });
  }
};

// Get Course Profile
exports.getCourseProfileById = async (req, res) => {
  try {
    const courseId = req.params.id;

    const course = await Course.findByPk(courseId);

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.json(course);
  } catch (error) {
    console.error("Course profile fetch error:", error);
    res.status(500).json({ message: "Server error fetching course profile" });
  }
};
exports.getAllCourses = async (req, res) => {
  try {
    const courses = await Course.findAll();
    res.json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ message: "Server error fetching courses" });
  }
};
// Update Course
exports.updateCourse = async (req, res) => {
  try {
    const courseId = req.params.id;
    const { course_name, course_full_name, course_status } = req.body;

    const [updatedRowsCount] = await Course.update(
      { course_name, course_full_name, course_status },
      { where: { course_id: courseId } }
    );

    if (updatedRowsCount === 0) {
      return res.status(404).json({ message: "Course not found" });
    }

    const updatedCourse = await Course.findByPk(courseId);

    res.json({
      message: "Course updated successfully",
      course: updatedCourse,
    });
  } catch (error) {
    console.error("Course update error:", error);
    res.status(500).json({ message: "Server error updating course" });
  }
};
