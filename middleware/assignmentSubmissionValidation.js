const { body, param } = require("express-validator");

exports.validateAssignmentSubmissionCreation = [
  body("std_rollno")
    .trim()
    .notEmpty()
    .withMessage("Student Roll Number is required"),

  body("tb_id")
    .notEmpty()
    .withMessage("Training Batch ID is required")
    .isInt()
    .withMessage("Training Batch ID must be an integer"),

  body("as_id")
    .notEmpty()
    .withMessage("Assignment ID is required")
    .isInt()
    .withMessage("Assignment ID must be an integer"),
];

exports.validateAssignmentSubmissionUpdate = [
  param("id")
    .notEmpty()
    .withMessage("Assignment Submission ID is required")
    .isInt()
    .withMessage("Assignment Submission ID must be an integer"),

  body("trainer_comments")
    .optional()
    .isString()
    .withMessage("Trainer Comments must be a string"),

  body("obt_marks")
    .optional()
    .isString()
    .withMessage("Obtained Marks must be a string"),

  body("as_submission_status")
    .optional()
    .isIn([0, 1])
    .withMessage("Assignment Submission Status must be 0 or 1"),
];
