const { body } = require("express-validator");

exports.validateStudentRegistration = [
  body("std_rollno")
    .trim()
    .optional()
    .isLength({ min: 3, max: 50 })
    .withMessage("Roll number must be between 3 and 50 characters"),

  body("std_cnic")
    .trim()
    .notEmpty()
    .withMessage("CNIC is required")
    .matches(/^\d{13}$/)
    .withMessage("CNIC must be 13 digits"),

  body("user_name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),

  body("std_fathername")
    .trim()
    .notEmpty()
    .withMessage("Father's name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Father's name must be between 2 and 100 characters"),

  body("std_gender")
    .notEmpty()
    .withMessage("Gender is required")
    .isIn(["Male", "Female", "Other"])
    .withMessage("Invalid gender"),

  body("std_qualification")
    .trim()
    .notEmpty()
    .withMessage("Qualification is required"),

  body("std_district").trim().notEmpty().withMessage("District is required"),

  body("user_email")
    .trim()
    .isEmail()
    .withMessage("Invalid email address")
    .normalizeEmail(),

  body("std_phone")
    .trim()
    .matches(/^[0-9]{11}$/)
    .withMessage("Phone number must be 11 digits"),


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
];