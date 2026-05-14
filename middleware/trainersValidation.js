const { body } = require("express-validator");

exports.validateTrainerRegistration = [
  body("t_cnic")
    .trim()
    .notEmpty()
    .withMessage("CNIC is required")
    .matches(/^\d{5}-\d{7}-\d{1}$/)
    .withMessage("Invalid CNIC format. Use 00000-0000000-0"),

  body("user_name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),

  body("user_email").trim().isEmail().withMessage("Invalid email address"),

  body("user_password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long")
    .matches(/\d/)
    .withMessage("Password must contain a number"),

  body("t_course_id")
    .notEmpty()
    .withMessage("Course ID is required")
    .isInt()
    .withMessage("Course ID must be an integer"),

  body("user_id")
    .notEmpty()
    .withMessage("Master Trainer ID is required")
    .isInt()
    .withMessage("Master Trainer ID must be an integer"),

  body("user_profile_photo")
    .optional()
    .isString()
    .withMessage("Profile photo must be a string"),

  body("dark_mode")
    .optional()
    .isIn([0, 1])
    .withMessage("Dark mode must be 0 or 1"),

  body("user_status")
    .optional()
    .isIn([0, 1])
    .withMessage("Status must be 0 or 1"),
];

exports.validateTrainerLogin = [
  body("t_email").trim().isEmail().withMessage("Invalid email address"),
  body("t_password").notEmpty().withMessage("Password is required"),
];
