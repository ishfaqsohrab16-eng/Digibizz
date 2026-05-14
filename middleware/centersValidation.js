const { body } = require("express-validator");
const Center = require("../models/center");

exports.validateCenter = [
  body("center_name")
    .trim()
    .isLength({ min: 2, max: 255 })
    .withMessage("Center name must be between 2 and 255 characters")
    .custom(async (value) => {
      const existingBatch = await Center.findOne({
        where: { center_name: value },
      });
      if (existingBatch) {
        throw new Error("Center already exists");
      }
      return true;
    }),
  body("center_location")
    .trim()
    .notEmpty()
    .withMessage("Center location is required")
    .isLength({ min: 5, max: 500 })
    .withMessage("Location must be between 5 and 500 characters")
    .custom(async (value) => {
      const existingBatch = await Center.findOne({
        where: { center_location: value },
      });
      if (existingBatch) {
        throw new Error("Center already exists");
      }
      return true;
    }),

  body("center_type")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Center type must be between 2 and 100 characters"),

  body("center_medium")
    .optional()
    .isIn(["Physical", "Online", "Hybrid"])
    .withMessage("Invalid center medium. Must be Physical, Online, or Hybrid"),

  body("center_status")
    .optional()
    .isIn([0, 1])
    .withMessage("Center status must be 0 or 1"),
];
