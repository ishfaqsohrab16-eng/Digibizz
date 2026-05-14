const { body } = require("express-validator");

exports.validateActivityLogCreation = [
  body("user_type")
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage("User type must be between 1 and 50 characters")
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage("User type must be alphabetic"),

  body("user_id")
    .trim()
    .notEmpty()
    .withMessage("User ID is required")
    .isLength({ max: 50 })
    .withMessage("User ID must be max 50 characters"),

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

  body("act_type")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Activity type must be between 1 and 100 characters"),

  body("act_descrip")
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage("Activity description must be between 1 and 255 characters"),

  body("act_content")
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage("Activity content must be between 1 and 255 characters"),
];
