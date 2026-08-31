const { sequelize } = require("../config/db");
const Candidate = require("../models/CandidateModel");
const Student = require("../models/studentModel");
const User = require("../models/userModel");
const Center = require("../models/center");
const Course = require("../models/course");
const TrainingBatch = require("../models/trainingBatcheModel");
const { sendEmailSafe, escapeHtml } = require("../servec/emailConfig");

/**
 * Enrol a recommended candidate as a student.
 *
 * Mirrors the roll-number scheme already used by the bulk importer
 * (Frontend/src/utils/rollNumber.ts): D + B<batch> + 7 random digits + a
 * weighted checksum digit, e.g. DB8-6273256-5. Generating it server-side means
 * uniqueness can actually be enforced against the database, which the
 * client-side version could not do.
 */

const generateRandomDigits = (length) => {
  let result = "";
  for (let index = 0; index < length; index += 1) {
    result += Math.floor(Math.random() * 10);
  }
  return result;
};

/** Sum of each digit multiplied by its 1-based position, mod 10. */
const calculateChecksum = (digits) =>
  digits
    .split("")
    .map(Number)
    .reduce((total, digit, index) => total + digit * (index + 1), 0) % 10;

const buildRollNumber = (batchId) => {
  const random = generateRandomDigits(7);
  return `DB${batchId}-${random}-${calculateChecksum(random)}`;
};

/** Generate a roll number that is not already taken. */
const generateUniqueRollNumber = async (batchId, transaction) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidateRoll = buildRollNumber(batchId);
    const clash = await Student.findOne({
      where: { std_rollno: candidateRoll },
      attributes: ["std_id"],
      transaction,
    });
    if (!clash) return candidateRoll;
  }
  throw new Error("Could not generate a unique roll number after 20 attempts");
};

/** Matches the existing convention: local part of the email plus "@". */
const buildUsername = (email) => {
  const clean = String(email || "").trim();
  if (!clean.includes("@")) return clean;
  return `${clean.split("@")[0]}@`;
};

/**
 * Details shown in the confirmation popup before enrolling.
 * GET /api/candidateRoutes/enrollment-preview/:cand_id
 */
exports.getEnrollmentPreview = async (req, res) => {
  try {
    const { cand_id } = req.params;

    const candidate = await Candidate.findByPk(cand_id, {
      include: [
        { model: Course, as: "courses", attributes: ["course_id", "course_name", "course_full_name"] },
        { model: Center, as: "centers", attributes: ["center_id", "center_name"] },
        { model: TrainingBatch, as: "training_batches", attributes: ["tb_id", "tb_name"] },
      ],
    });

    if (!candidate) {
      return res.status(404).json({ success: false, message: "Candidate not found" });
    }

    const alreadyEnrolled = await Student.findOne({
      where: { std_cnic: candidate.cand_cnic, tb_id: candidate.tb_id },
      attributes: ["std_id", "std_rollno"],
      raw: true,
    });

    return res.json({
      success: true,
      candidate: {
        cand_id: candidate.cand_id,
        name: candidate.cand_name,
        father_name: candidate.cand_fathername,
        cnic: candidate.cand_cnic,
        email: candidate.cand_email,
        phone: candidate.cand_phone,
        gender: candidate.cand_gender,
        qualification: candidate.cand_degree_level,
        district: candidate.cand_local_domicile,
        recommended: candidate.recommended,
        admission_status: candidate.cand_admission_status,
        is_uob_student: candidate.is_uob_student,
      },
      enrollment: {
        center_id: candidate.centers?.center_id ?? candidate.center_id,
        center_name: candidate.centers?.center_name || "",
        course_id: candidate.courses?.course_id ?? candidate.course_id,
        course_name:
          candidate.courses?.course_full_name || candidate.courses?.course_name || "",
        tb_id: candidate.training_batches?.tb_id ?? candidate.tb_id,
        batch_name: candidate.training_batches?.tb_name || "",
      },
      alreadyEnrolled: alreadyEnrolled
        ? { std_id: alreadyEnrolled.std_id, std_rollno: alreadyEnrolled.std_rollno }
        : null,
      eligible: candidate.recommended === "Yes" && !alreadyEnrolled,
    });
  } catch (error) {
    console.error("Enrollment preview error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error building enrollment preview" });
  }
};

/**
 * Enrol the candidate.
 * POST /api/candidateRoutes/enroll/:cand_id
 */
exports.enrollCandidate = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { cand_id } = req.params;

    const candidate = await Candidate.findByPk(cand_id, { transaction });

    if (!candidate) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Candidate not found" });
    }

    // Only recommended candidates may be enrolled.
    if (candidate.recommended !== "Yes") {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Only candidates recommended at interview can be enrolled",
      });
    }

    // Guard against double enrolment from a double-click or a stale list.
    const existingStudent = await Student.findOne({
      where: { std_cnic: candidate.cand_cnic, tb_id: candidate.tb_id },
      attributes: ["std_id", "std_rollno"],
      transaction,
    });

    if (existingStudent) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: `This candidate is already enrolled (roll no ${existingStudent.std_rollno})`,
      });
    }

    const email = String(candidate.cand_email || "").trim().toLowerCase();
    if (!email) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Candidate has no email address" });
    }

    const existingUser = await User.findOne({
      where: { user_email: email },
      attributes: ["user_id"],
      transaction,
    });

    if (existingUser) {
      await transaction.rollback();
      return res.status(409).json({
        success: false,
        message: "A user account already exists with this email address",
      });
    }

    // Admins may override the center/course in the confirmation popup.
    const centerId = req.body.center_id || candidate.center_id;
    const courseId = req.body.course_id || candidate.course_id;
    const batchId = req.body.tb_id || candidate.tb_id;

    const rollNumber =
      String(req.body.std_rollno || "").trim() ||
      (await generateUniqueRollNumber(batchId, transaction));

    // Password is left blank on purpose: students set their own on first
    // login, exactly as the existing student registration flow does.
    const newUser = await User.create(
      {
        user_name: String(candidate.cand_name || "").trim(),
        user_email: email,
        user_password: "",
        user_username: buildUsername(email),
        user_profile_photo: candidate.cand_photo || null,
        user_type: "student",
        user_status: 1,
      },
      { transaction }
    );

    const newStudent = await Student.create(
      {
        user_id: newUser.user_id,
        std_rollno: rollNumber,
        std_cnic: candidate.cand_cnic,
        std_fathername: candidate.cand_fathername,
        std_gender: candidate.cand_gender,
        std_qualification: candidate.cand_degree_level,
        std_district: candidate.cand_local_domicile,
        std_phone: candidate.cand_phone,
        course_id: courseId,
        center_id: centerId,
        tb_id: batchId,
        dark_mode: 0,
        special_case: 0,
        special_case_comments: "",
        std_added_on: new Date().toISOString().split("T")[0],
        std_lms_status: 1,
        std_forum_status: 1,
      },
      { transaction }
    );

    await transaction.commit();

    // Best-effort: never let a mail problem undo a committed enrolment.
    const [center, course] = await Promise.all([
      Center.findByPk(centerId, { attributes: ["center_name"] }),
      Course.findByPk(courseId, { attributes: ["course_name", "course_full_name"] }),
    ]);

    const courseName = course?.course_full_name || course?.course_name || "";
    sendEmailSafe(
      email,
      "You are enrolled - Digibizz Program",
      `Dear ${candidate.cand_name},\n\nCongratulations! You have been enrolled in the Digibizz Program.\n\nRoll Number: ${rollNumber}\nCourse: ${courseName}\nCenter: ${center?.center_name || ""}\n\nPlease visit the Digibizz LMS and set your password to start learning.`,
      `<p>Dear <strong>${escapeHtml(candidate.cand_name)}</strong>,</p>
       <p>Congratulations! You have been enrolled in the Digibizz Program.</p>
       <p><strong>Roll Number:</strong> ${escapeHtml(rollNumber)}<br/>
          <strong>Course:</strong> ${escapeHtml(courseName)}<br/>
          <strong>Center:</strong> ${escapeHtml(center?.center_name || "")}</p>
       <p>Please visit the Digibizz LMS and set your password to start learning.</p>`
    );

    console.log(
      `[enroll] candidate ${candidate.cand_id} enrolled as ${rollNumber} by user ${req.user.id} (${req.user.username})`
    );

    return res.status(201).json({
      success: true,
      message: "Candidate enrolled successfully",
      student: {
        std_id: newStudent.std_id,
        std_rollno: rollNumber,
        user_id: newUser.user_id,
        name: newUser.user_name,
        email: newUser.user_email,
        center_id: centerId,
        course_id: courseId,
        tb_id: batchId,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Candidate enrollment error:", error);

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "A student with this roll number, CNIC or email already exists",
      });
    }

    // Say which field the applicant's record fails on. A bare 500 sent the
    // admin to the server log to find out that a gender was spelled in lower
    // case - a question the response could have answered.
    if (error.name === "SequelizeValidationError") {
      const details = (error.errors || [])
        .map((item) => `${item.path}: ${item.message}`)
        .join("; ");
      return res.status(400).json({
        success: false,
        message: `This candidate's record cannot be enrolled as it stands. ${details}`,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error while enrolling candidate",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
