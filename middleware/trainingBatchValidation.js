const { body } = require("express-validator");
const TrainingBatch = require("../models/trainingBatcheModel");

exports.validateTrainingBatch = [
  body("tb_name")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Batch name must be between 2 and 100 characters")
    .custom(async (value) => {
      const existingBatch = await TrainingBatch.findOne({
        where: { tb_name: value },
      });
      if (existingBatch) {
        throw new Error("Batch already exists");
      }
      return true;
    }),

  body("tb_slug")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Batch slug must be between 2 and 50 characters")
    .matches(/^[a-zA-Z0-9-]+$/)
    .withMessage("Slug must be alphanumeric with optional hyphens"),

  body("tb_descrip")
    .trim()
    .isLength({ min: 10, max: 255 })
    .withMessage("Description must be between 10 and 255 characters"),

  body("tb_start").trim().notEmpty().withMessage("Start date is required"),

  body("tb_end")
    .trim()
    .notEmpty()
    .withMessage("End date is required")
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.tb_start)) {
        throw new Error("End date must be after start date");
      }
      return true;
    }),
];
