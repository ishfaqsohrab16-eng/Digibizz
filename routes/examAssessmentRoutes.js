const express = require("express");
const {
  createExamAssessment,
  getFinalExamAssessments,
  getExamAssessmentById,
  updateExamAssessment,
  deleteExamAssessment,
  getExamAssessmentsBytb,
  getExamAssessmentsAll
} = require("../controllers/examAssessmentController");
const {
  validateExamAssessment,
  validateId,
  handleValidationErrors,
} = require("../middleware/examValidation");
const { isAdminAuthenticated } = require("../middleware/authMiddleware");
const router = express.Router();

router.post("/", isAdminAuthenticated, createExamAssessment);
router.get(
  "/:std_cnic/:tb_id/:ea_type",
  isAdminAuthenticated,
  getFinalExamAssessments
);
router.get(
  "/:tb_id/:user_type/:user_id/:ea_type",
  isAdminAuthenticated,
  getExamAssessmentsBytb
);
router.get("/all", isAdminAuthenticated, getExamAssessmentsAll);
router.get(
  "/:id",
  validateId,
  isAdminAuthenticated,
  handleValidationErrors,
  getExamAssessmentById
);
router.put(
  "/:id",
  validateId,
  validateExamAssessment,
  isAdminAuthenticated,
  handleValidationErrors,
  updateExamAssessment
);
router.delete(
  "/:id",
  validateId,
  isAdminAuthenticated,
  handleValidationErrors,
  deleteExamAssessment
);

module.exports = router;
