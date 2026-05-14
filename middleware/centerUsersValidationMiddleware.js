const { body } = require("express-validator");

exports.validateCenterUserRegistration = [
  // body("cu_user")
  //   .trim()
  //   .isLength({ min: 3, max: 50 })
  //   .withMessage("Username must be between 3 and 50 characters")
  //   .isAlphanumeric()
  //   .withMessage("Username must be alphanumeric"),
  // body("cu_pass")
  //   .isLength({ min: 6 })
  //   .withMessage("Password must be at least 6 characters long")
  //   .matches(/\d/)
  //   .withMessage("Password must contain a number"),
  // body("center_id")
  //   .notEmpty()
  //   .withMessage("Center ID is required")
  //   .isInt()
  //   .withMessage("Center ID must be an integer"),
  // body("cu_type")
  //   .optional()
  //   .isIn(["Admin", "Coordinator", "Manager"])
  //   .withMessage("Invalid center user type"),
  // body("cu_status")
  //   .optional()
  //   .isIn([0, 1])
  //   .withMessage("Center user status must be 0 or 1"),
];

exports.validateCenterUserLogin = [
  // body("cu_user").trim().notEmpty().withMessage("Username is required"),
  // body("cu_pass").notEmpty().withMessage("Password is required"),
];
