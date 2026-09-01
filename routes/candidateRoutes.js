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
const multer = require("multer");

/**
 * The CNIC list is parsed and thrown away, never stored, so it is kept in
 * memory rather than written to disk - an uploaded list of national ID
 * numbers left lying in uploads/ is a liability nobody would remember to
 * clear.
 */
const cnicUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Browsers disagree about the MIME type of a .csv, so the extension is
    // accepted as well - otherwise a perfectly good file is refused.
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
      "application/csv",
      "text/plain",
    ];
    const byExtension = /.(xlsx|xls|csv)$/i.test(file.originalname || "");
    cb(null, allowed.includes(file.mimetype) || byExtension);
  },
});
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

// Public: the registration form asks this while the applicant types, so a
// duplicate email or phone is caught in the field rather than on submit.
router.get("/contact-available", candidateController.checkContactAvailability);

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

// --- Bulk enrolment from an uploaded CNIC list ------------------------------
//
// Same guard as the single enrolment above: these create real LMS accounts,
// in bulk, so they are not a step down in privilege from doing it by hand.
router.get(
  "/bulk-enroll/template",
  isAdminAuthenticated,
  requireRoles(ADMIN_ROLES),
  candidateEnrollmentController.downloadCnicTemplate
);

// Dry run. Writes nothing; says who would be enrolled and who would not.
router.post(
  "/bulk-enroll/preview",
  isAdminAuthenticated,
  requireRoles(ADMIN_ROLES),
  cnicUpload.single("file"),
  candidateEnrollmentController.previewBulkEnrollment
);

router.post(
  "/bulk-enroll",
  isAdminAuthenticated,
  requireRoles(ADMIN_ROLES),
  cnicUpload.single("file"),
  candidateEnrollmentController.bulkEnrollByCnic
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
