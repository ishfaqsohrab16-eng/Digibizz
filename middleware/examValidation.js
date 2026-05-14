const { body, param, validationResult } = require("express-validator");

const validateExamAssessment = [
  body("std_cnic").notEmpty().withMessage("Student CNIC is required"),
  body("tb_id").isInt().withMessage("Training Batch ID must be an integer"),
  body("center_id").isInt().withMessage("Center ID must be an integer"),
  body("course_id").isInt().withMessage("Course ID must be an integer"),
  body("class_participation")
    .isDecimal()
    .withMessage("Class Participation must be a decimal"),
  body("final_task").isDecimal().withMessage("Final Task must be a decimal"),
  body("presentation")
    .isDecimal()
    .withMessage("Presentation must be a decimal"),
  body("viva").isDecimal().withMessage("Viva must be a decimal"),
  body("total_score").isDecimal().withMessage("Total Score must be a decimal"),
  body("ea_type").notEmpty().withMessage("Exam Assessment Type is required"),
];

const validateId = [
  param("id").isInt().withMessage("Exam Assessment ID must be an integer"),
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

module.exports = {
  validateExamAssessment,
  validateId,
  handleValidationErrors,
};
