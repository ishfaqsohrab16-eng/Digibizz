const { body } = require("express-validator");

exports.validateCenterDateCreation = [
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

  body("tb_start")
    .trim()
    .notEmpty()
    .withMessage("Training start date is required"),

  body("tb_end").trim().notEmpty().withMessage("Training end date is required"),
];
