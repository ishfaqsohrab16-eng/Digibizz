const { body } = require("express-validator");

/**
 * Validation rules for user registration
 */
exports.validateuserRegistration = [
  body("user_name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),

  body("user_username")
    .trim()
    .notEmpty()
    .withMessage("Username is required")
    .isLength({ min: 4, max: 20 })
    .withMessage("Username must be between 4 and 20 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers and underscores"),

  //   body("user_type")
  //     .optional()
  //     .isIn([
  //       "SuperAdmin",
  //       "ContentAdmin",
  //       "ReadOnlyAdmin",
  //       "MasterTrainer",
  //       "Trainer",
  //       "Student",
  //       "Coordinator",
  //       "Manager",
  //     ])
  //     .withMessage("Invalid user type"),
];
exports.validatePasswordChange = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Current password is required"),
  body("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .isLength({ min: 6 })
    .withMessage("New password must be at least 6 characters long"),
];
/**
 * Validation rules for user login
 */
exports.validateuserLogin = [
  body("user_username").trim().notEmpty().withMessage("Username is required"),

  body("user_password").trim().notEmpty().withMessage("Password is required"),
];
