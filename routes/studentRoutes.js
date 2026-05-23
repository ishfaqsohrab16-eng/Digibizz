const express = require("express");
const router = express.Router();
const studentController = require("../controllers/studentController");
const {
  validateStudentRegistration,
} = require("../middleware/studentValidation");
const { isAdminAuthenticated } = require("../middleware/authMiddleware");
// Register Student
const upload = require("../middleware/uploadConfig");
// Register Trainer
router.post(
  "/register",
  upload.single("profile_photo"),
  validateStudentRegistration,
  studentController.registerStudent
);

// Get Student Profile
router.get(
  "/profile/:tb_id",
  isAdminAuthenticated,
  studentController.getStudentProfile
);

// Update Student Profile - Change the route to include user_id parameter
router.put(
  "/profile",
  upload.single("profile_photo"),
  isAdminAuthenticated,
  studentController.updateStudentProfile
);

router.get(
  "/getStudentById/:user_id",
  isAdminAuthenticated,
  studentController.getStudentProfileByUserId
);
router.get(
  "/getStudentProfileByCNIC/:std_cnic",
  isAdminAuthenticated,
  studentController.getStudentProfileByCNIC
);
router.get(
  "/getStudentProfileByEmail/:user_email",
  isAdminAuthenticated,
  studentController.getStudentProfileByEmail
);
router.get(
  "/getStudentByCNIC/:std_cnic",
  studentController.getStudentProfileByCNIC
);
router.put(
  "/profile/SuspendStudentByCNIC",
  isAdminAuthenticated,
  studentController.SuspendStudentByCNIC
);
router.put(
  "/profile/UnSuspendStudentByCNIC",
  isAdminAuthenticated,
  studentController.UnSuspendStudentByCNIC
);
router.post(
  "/send-mail",
  // Optionally add authentication middleware here
  studentController.sendStudentMail
);
module.exports = router;
