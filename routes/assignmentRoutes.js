const express = require("express");
const router = express.Router();
const assignmentController = require("../controllers/assignmentController");
const {
  validateAssignmentCreation,
  validateAssignmentUpdate,
  validateAssignmentQuery,
} = require("../middleware/assignmentValidation");
const {
  isAdminAuthenticated,
  requireRoles,
  ROLES,
  ADMIN_ROLES,
} = require("../middleware/authMiddleware");
const {
  upload,
  handleUploadError,
} = require("../middleware/uploadAssignmentConfig");

/**
 * Assignments.
 *
 * Every route here was previously unauthenticated. `isAdminAuthenticated` was
 * imported and never used, so anyone who could reach the server could create,
 * edit and DELETE any assignment - and deleting one takes every student's
 * submission with it. Nothing about the module suggested that; the import
 * sitting there unused made it look guarded.
 *
 * Applied to the whole router rather than per route, so a route added later is
 * locked down by default instead of open until somebody remembers.
 */
router.use(isAdminAuthenticated);

/** Who may set work: the trainers who teach, and the staff above them. */
const AUTHORS = [ROLES.TRAINER, ...ADMIN_ROLES];

// Create Assignment.
//
// Auth runs BEFORE the upload: multer writes the file to disk as it parses the
// request, so an unauthenticated POST used to leave a file behind before being
// refused. validateAssignmentCreation was imported but never wired up, which is
// why the controller's validationResult() always came back empty.
router.post(
  "/",
  requireRoles(AUTHORS),
  upload.single("assignment_attachment"),
  handleUploadError,
  validateAssignmentCreation,
  assignmentController.createAssignment
);

// One assignment, by its own id.
//
// Deliberately NOT "/:id". Express matches in order, and "/:tb_id" below is the
// same shape, so it swallowed every request - getAssignmentById was unreachable
// dead code and /assignments/5 silently meant "list batch 5".
router.get("/single/:id", assignmentController.getAssignmentById);

// Every assignment in a batch, scoped to whoever is asking.
router.get(
  "/:tb_id",
  validateAssignmentQuery,
  assignmentController.getAllAssignmentsByTB
);

router.put(
  "/:as_id",
  requireRoles(AUTHORS),
  upload.single("assignment_attachment"),
  handleUploadError,
  validateAssignmentUpdate,
  assignmentController.updateAssignment
);

router.delete(
  "/:id",
  requireRoles(AUTHORS),
  assignmentController.deleteAssignment
);

module.exports = router;
