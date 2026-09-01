const { body, param } = require("express-validator");

/**
 * Validation for assignment submissions.
 *
 * `std_rollno` is deliberately no longer accepted from the body on creation.
 * The controller now takes the student from the signed-in user, because a roll
 * number in a request body is a claim, not an identity - anyone could submit
 * work as somebody else by typing their number.
 *
 * The update rules checked `param("id")` while the route is "/:as_id", so the
 * check could only ever fail. It never showed because the controller did not
 * read the result.
 */

exports.validateAssignmentSubmissionCreation = [
  body("tb_id")
    .notEmpty()
    .withMessage("Training batch is required")
    .isInt({ min: 1 })
    .withMessage("Training batch must be a whole number"),

  body("as_id")
    .notEmpty()
    .withMessage("Assignment is required")
    .isInt({ min: 1 })
    .withMessage("Assignment id must be a whole number"),

  body("as_submission_comment")
    .optional({ nullable: true })
    .isLength({ max: 5000 })
    .withMessage("Keep your comment under 5000 characters"),
];

exports.validateAssignmentSubmissionUpdate = [
  param("as_id")
    .isInt({ min: 1 })
    .withMessage("Submission id must be a whole number"),

  body("trainer_comments")
    .optional({ nullable: true })
    .isLength({ max: 5000 })
    .withMessage("Keep the feedback under 5000 characters"),

  // Marks are checked against the assignment's total in the controller, which
  // is the only place that knows what it is. This only rejects what is not a
  // number at all - the column is a string, so "abc" would otherwise store.
  body("obt_marks")
    .optional({ nullable: true })
    .custom((value) => value === "" || !Number.isNaN(Number(value)))
    .withMessage("Marks must be a number"),

  body("as_submission_status")
    .optional()
    .isIn([0, 1, 2, "0", "1", "2"])
    .withMessage("Status must be 0 (submitted), 1 (marked) or 2 (returned)"),
];
