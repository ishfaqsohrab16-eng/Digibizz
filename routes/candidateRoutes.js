const express = require("express");
const router = express.Router();
const candidateController = require("../controllers/candidateController");
const candidateEnrollmentController = require("../controllers/candidateEnrollmentController");
const { body } = require("express-validator");
const {
  isAdminAuthenticated,
  requireRoles,
  ROLES,
  ADMIN_ROLES,
} = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadCandidates");
const {
  checkCandidateByCnic,
  updateTestMarks,
  getAllCandidates,
  getAllSelectedCandidates,
} = require("../controllers/candidateController");
// Validation middleware
const candidateValidation = [
  body("cand_cnic").notEmpty().withMessage("CNIC is required"),
  body("cand_name").notEmpty().withMessage("Name is required"),
  body("cand_fathername").notEmpty().withMessage("Father's name is required"),
  body("cand_email").isEmail().withMessage("Valid email is required"),
  body("cand_phone").notEmpty().withMessage("Phone number is required"),
  // Add more validation as needed
];

// Create candidate
router.post(
  "/",
  upload.single("cand_photo"),
  candidateValidation,
  candidateController.createCandidate
);
router.get("/check-cnic/:cnic", checkCandidateByCnic);
router.patch("/update-test-marks/:id", updateTestMarks);
// Get all candidates
router.get("/profile/:tb_id", isAdminAuthenticated, getAllCandidates);

// Update interview data
router.put(
  "/interview-data/:candidateId",
  candidateController.updateInterviewData
);

// Suspend candidate
router.put("/suspend/:candidateId", candidateController.suspendCandidate);
router.get("/selected/:tb_id", isAdminAuthenticated, getAllSelectedCandidates);

// --- Enrollment (recommended candidates only) -------------------------------
router.get(
  "/enrollment-preview/:cand_id",
  isAdminAuthenticated,
  requireRoles(ADMIN_ROLES),
  candidateEnrollmentController.getEnrollmentPreview
);

router.post(
  "/enroll/:cand_id",
  isAdminAuthenticated,
  requireRoles(ADMIN_ROLES),
  candidateEnrollmentController.enrollCandidate
);

// --- Center / domain change (SuperAdmin only, pre-enrollment) ----------------
router.patch(
  "/change-center-course/:cand_id",
  isAdminAuthenticated,
  requireRoles(ROLES.SUPER_ADMIN),
  candidateController.changeCandidateCenterOrCourse
);
// // Get candidate by ID
// router.get("/:id", auth, candidateController.getCandidateById);

// // Update candidate
// router.put(
//   "/:id",
//   auth,
//   candidateValidation,
//   candidateController.updateCandidate
// );

// // Update admission status
// router.patch(
//   "/:id/admission-status",
//   auth,
//   [
//     body("cand_admission_status")
//       .isInt()
//       .withMessage("Valid admission status is required"),
//   ],
//   candidateController.updateAdmissionStatus
// );

// // Update interview marks
// router.patch(
//   "/:id/interview-marks",
//   auth,
//   [
//     body("cand_interview_marks")
//       .notEmpty()
//       .withMessage("Interview marks are required"),
//     body("interview_date").notEmpty().withMessage("Interview date is required"),
//   ],
//   candidateController.updateInterviewMarks
// );

module.exports = router;
