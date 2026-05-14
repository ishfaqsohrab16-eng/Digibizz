const { body } = require("express-validator");

// Quiz Validation
exports.validateQuizCreation = [
  body("quiz_title")
    .trim()
    .notEmpty()
    .withMessage("Quiz title is required")
    .isLength({ max: 255 })
    .withMessage("Quiz title cannot exceed 255 characters"),

  body("t_id").isInt().withMessage("Valid teacher ID is required"),

  body("quiz_tab_change")
    .isIn(["ON", "OFF"])
    .withMessage("Tab change must be ON or OFF"),

  body("quiz_passing_score")
    .isInt({ min: 0, max: 100 })
    .withMessage("Passing score must be between 0 and 100"),

  body("quiz_time_limit")
    .isInt({ min: 1 })
    .withMessage("Time limit must be at least 1 minute"),

  body("quiz_attempts_limit")
    .isInt({ min: 1 })
    .withMessage("Attempts limit must be at least 1"),

  body("quiz_result_answers")
    .isIn(["ON", "OFF"])
    .withMessage("Result answers must be ON or OFF"),

  body("questions")
    .isArray({ min: 1 })
    .withMessage("At least one question is required"),

  body("questions.*.q_title")
    .trim()
    .notEmpty()
    .withMessage("Question title is required")
    .isLength({ max: 255 })
    .withMessage("Question title cannot exceed 255 characters"),

  body("questions.*.a1")
    .trim()
    .notEmpty()
    .withMessage("Answer choice 1 is required")
    .isLength({ max: 255 })
    .withMessage("Answer cannot exceed 255 characters"),

  body("questions.*.a2")
    .trim()
    .notEmpty()
    .withMessage("Answer choice 2 is required")
    .isLength({ max: 255 })
    .withMessage("Answer cannot exceed 255 characters"),

  body("questions.*.a3")
    .trim()
    .notEmpty()
    .withMessage("Answer choice 3 is required")
    .isLength({ max: 255 })
    .withMessage("Answer cannot exceed 255 characters"),

  body("questions.*.a4")
    .trim()
    .notEmpty()
    .withMessage("Answer choice 4 is required")
    .isLength({ max: 255 })
    .withMessage("Answer cannot exceed 255 characters"),

  body("questions.*.correct_a")
    .trim()
    .notEmpty()
    .withMessage("Correct answer is required")
    .isLength({ max: 255 })
    .withMessage("Correct answer cannot exceed 255 characters"),

  body("questions.*.correct_a_reason")
    .trim()
    .notEmpty()
    .withMessage("Correct answer reason is required"),
];

exports.validateQuizAttempt = [
  body("quiz_code").trim().notEmpty().withMessage("Quiz code is required"),

  body("tb_id").isInt().withMessage("Valid training batch ID is required"),
];

exports.validateQuizSubmission = [
  body("attempt_session")
    .trim()
    .notEmpty()
    .withMessage("Attempt session is required"),

  body("answers")
    .isArray({ min: 1 })
    .withMessage("At least one answer is required"),

  body("answers.*.q_id")
    .trim()
    .notEmpty()
    .withMessage("Question ID is required"),

  body("answers.*.answer").trim().notEmpty().withMessage("Answer is required"),
];

// Ticket Validation
exports.validateTicketCreation = [
  body("std_rollno")
    .trim()
    .notEmpty()
    .withMessage("Student roll number is required")
    .isLength({ max: 50 })
    .withMessage("Student roll number cannot exceed 50 characters"),

  body("ticket_subject")
    .trim()
    .notEmpty()
    .withMessage("Ticket subject is required")
    .isLength({ max: 100 })
    .withMessage("Ticket subject cannot exceed 100 characters"),

  body("ticket_description")
    .trim()
    .notEmpty()
    .withMessage("Ticket description is required"),

  body("tb_id").isInt().withMessage("Valid training batch ID is required"),

  body("t_id").isInt().withMessage("Valid teacher ID is required"),

  body("center_id").isInt().withMessage("Valid center ID is required"),

  body("course_id").isInt().withMessage("Valid course ID is required"),

  body("ticket_to")
    .trim()
    .notEmpty()
    .withMessage("Ticket recipient is required")
    .isLength({ max: 50 })
    .withMessage("Ticket recipient cannot exceed 50 characters"),
];

exports.validateTicketReply = [
  body("ticket_no")
    .trim()
    .notEmpty()
    .withMessage("Ticket number is required")
    .isLength({ max: 50 })
    .withMessage("Ticket number cannot exceed 50 characters"),

  body("reply_by")
    .trim()
    .notEmpty()
    .withMessage("Replier information is required")
    .isLength({ max: 50 })
    .withMessage("Replier information cannot exceed 50 characters"),

  body("reply_message")
    .trim()
    .notEmpty()
    .withMessage("Reply message is required"),
];
