const { body, param, query } = require("express-validator");

exports.validateAssignmentCreation = [
  body("course_id")
    .notEmpty()
    .withMessage("Course ID is required")
    .isInt()
    .withMessage("Course ID must be an integer"),

  body("center_id")
    .notEmpty()
    .withMessage("Center ID is required")
    .isInt()
    .withMessage("Center ID must be an integer"),

  body("tb_id")
    .notEmpty()
    .withMessage("Training Batch ID is required")
    .isInt()
    .withMessage("Training Batch ID must be an integer"),

  body("as_title")
    .trim()
    .notEmpty()
    .withMessage("Assignment Title is required")
    .isLength({ max: 255 })
    .withMessage("Assignment Title must be less than 255 characters"),

  body("as_description")
    .trim()
    .notEmpty()
    .withMessage("Assignment Description is required"),

  body("as_instructions")
    .optional()
    .isString()
    .withMessage("Assignment Instructions must be a string"),

  body("as_max_marks")
    .notEmpty()
    .withMessage("Maximum Marks is required")
    .isInt({ min: 0 })
    .withMessage("Maximum Marks must be a non-negative integer"),

  body("as_deadline")
    .notEmpty()
    .withMessage("Assignment Deadline is required")
    .isISO8601()
    .withMessage("Invalid date format for deadline"),

  body("as_status")
    .optional()
    .isIn([0, 1])
    .withMessage("Assignment Status must be 0 or 1"),
];

exports.validateAssignmentUpdate = [
  param("id")
    .notEmpty()
    .withMessage("Assignment ID is required")
    .isInt()
    .withMessage("Assignment ID must be an integer"),

  body("as_title")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Assignment Title cannot be empty")
    .isLength({ max: 255 })
    .withMessage("Assignment Title must be less than 255 characters"),

  body("as_description")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Assignment Description cannot be empty"),

  body("as_instructions")
    .optional()
    .isString()
    .withMessage("Assignment Instructions must be a string"),

  body("as_max_marks")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Maximum Marks must be a non-negative integer"),

  body("as_deadline")
    .optional()
    .isISO8601()
    .withMessage("Invalid date format for deadline"),

  body("as_status")
    .optional()
    .isIn([0, 1])
    .withMessage("Assignment Status must be 0 or 1"),
];

exports.validateAssignmentQuery = [
  query("center_id")
    .optional()
    .isInt()
    .withMessage("Center ID must be an integer"),

  query("course_id")
    .optional()
    .isInt()
    .withMessage("Course ID must be an integer"),

  query("tb_id")
    .optional()
    .isInt()
    .withMessage("Training Batch ID must be an integer"),
];
