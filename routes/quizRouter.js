const express = require("express");
const router = express.Router();
const quizController = require("../controllers/quizController");
const {
  validateQuizCreation,
  validateQuizAttempt,
  validateQuizSubmission,
} = require("../middleware/quizValidation");
const { isAdminAuthenticated } = require("../middleware/authMiddleware");

// Quiz Creation and Management Routes (Teacher)
router.post(
  "/create/:tb_id/:t_id",
  isAdminAuthenticated,
  quizController.createQuiz
);

router.put(
  "/update/:quiz_code",
  isAdminAuthenticated,
  quizController.updateQuiz
);

router.delete(
  "/delete/:quiz_code",
  isAdminAuthenticated,
  quizController.deleteQuiz
);

router.get(
  "/teacher/:user_id/:tb_id",
  isAdminAuthenticated,
  quizController.getTeacherQuizzes
);
router.get(
  "/student/:user_id/:tb_id",
  isAdminAuthenticated,
  quizController.getStudentQuizzes
);
router.get(
  "/details/:quiz_code",
  isAdminAuthenticated,
  quizController.getQuizDetails
);
router.get(
  "/results/:quiz_code",
  isAdminAuthenticated,
  quizController.getStudentQuizResultList
)

// Quiz Attempt Routes (Student)
router.post(
  "/start",
  isAdminAuthenticated,
  validateQuizAttempt,
  quizController.startQuizAttempt
);

router.post(
  "/submit",
  isAdminAuthenticated,
  validateQuizSubmission,
  quizController.submitQuizAnswers
);

router.get(
  "/results/:std_cnic",
  isAdminAuthenticated,
  quizController.getStudentQuizResults
);

module.exports = router;
