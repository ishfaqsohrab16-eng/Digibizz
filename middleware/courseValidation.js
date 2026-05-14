const { body } = require("express-validator");

exports.validateCourseCreation = [
  body("course_name")
    .notEmpty()
    .withMessage("Course name is required")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Course name must be between 2 and 100 characters"),

  body("course_full_name")
    .notEmpty()
    .withMessage("Course full name is required")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Course full name must be between 2 and 100 characters"),

  body("course_status")
    .notEmpty()
    .withMessage("Course status is required")
    .trim()
    .toInt()
    .isIn([0, 1])
    .withMessage("Course status must be 0 or 1"),
];
