const { body } = require("express-validator");

/**
 * Validation rules for admin registration
 */
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
 * Validation rules for admin login
 */
exports.validateUserLogin = [
  body("user_username").trim().notEmpty().withMessage("Username is required"),

  body("user_password").trim().notEmpty().withMessage("Password is required"),
];
