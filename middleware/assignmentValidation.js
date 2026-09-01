const { body, param } = require("express-validator");

/**
 * Validation for the assignment endpoints.
 *
 * Rewritten because the previous rules described a different API from the one
 * that exists, and were therefore never usable:
 *
 *   - creation demanded course_id and center_id in the body. The controller
 *     derives both from the trainer's allocations and the form has never sent
 *     them, so wiring this in would have refused every real request.
 *   - it demanded `as_max_marks`. The column, the model and the controller all
 *     call it `as_marks`.
 *   - the update rules checked `param("id")` while the route is "/:as_id", so
 *     that check could only ever fail.
 *
 * None of it mattered, because the create route never applied the validator and
 * the update controller never read the result. Both are fixed, so these rules
 * now have to be right.
 */

/** The deadline is stored as text but must still be a real moment in time. */
const isParsableDate = (value) => !Number.isNaN(new Date(value).getTime());

exports.validateAssignmentCreation = [
  body("tb_id")
    .notEmpty()
    .withMessage("Training batch is required")
    .isInt({ min: 1 })
    .withMessage("Training batch must be a whole number"),

  body("as_title")
    .trim()
    .notEmpty()
    .withMessage("Give the assignment a title")
    .isLength({ max: 255 })
    .withMessage("Keep the title under 255 characters"),

  body("as_description")
    .trim()
    .notEmpty()
    .withMessage("Describe what the students have to do"),

  body("as_marks")
    .notEmpty()
    .withMessage("Total marks are required")
    // Minimum 1: an assignment worth zero marks cannot be graded, and every
    // percentage calculated from it divides by zero.
    .isInt({ min: 1, max: 10000 })
    .withMessage("Total marks must be a whole number between 1 and 10000"),

  body("as_deadline")
    .notEmpty()
    .withMessage("A deadline is required")
    .custom(isParsableDate)
    .withMessage("That deadline is not a valid date and time"),
];

exports.validateAssignmentUpdate = [
  param("as_id")
    .isInt({ min: 1 })
    .withMessage("Assignment id must be a whole number"),

  body("as_title")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("The title cannot be emptied")
    .isLength({ max: 255 })
    .withMessage("Keep the title under 255 characters"),

  body("as_description")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("The description cannot be emptied"),

  body("as_marks")
    .optional()
    .isInt({ min: 1, max: 10000 })
    .withMessage("Total marks must be a whole number between 1 and 10000"),

  body("as_deadline")
    .optional()
    .custom(isParsableDate)
    .withMessage("That deadline is not a valid date and time"),

  body("as_status")
    .optional()
    .isIn([0, 1, "0", "1"])
    .withMessage("Status must be 0 or 1"),
];

exports.validateAssignmentQuery = [
  param("tb_id")
    .isInt({ min: 1 })
    .withMessage("Training batch must be a whole number"),
];
