const Candidate = require("../models/CandidateModel");
const Course = require("../models/course");
const Center = require("../models/center");
const TrainingBatch = require("../models/trainingBatcheModel");
const { validationResult } = require("express-validator");
const { Op } = require("sequelize");
const db = require("../config/db"); // Add this line to import your database configuration
const sequelize = db.sequelize;
const Student = require("../models/studentModel");
const { sendEmailSafe } = require("../servec/emailConfig");
const { applicationReceived } = require("../servec/emailTemplates");
const { ADMISSION_BATCH_LABEL } = require("../servec/admissionBatch");
const { validateAdmissionAvailability } = require("./admissionControlController");
const AdmissionControl = require("../models/admissionControlModel");

/**
 * Read one figure out of the grouped gender statistics.
 *
 * cand_gender is free text and has been stored as "Male", "male", "FEMALE" and
 * with stray whitespace over the years. The previous code compared male
 * case-insensitively but female with an exact "Female" match, so every row
 * stored in another casing vanished and the Female card read 0 while the
 * center breakdown plainly showed hundreds of women. Normalise both sides, and
 * sum rather than take the first match so two casings of the same gender are
 * added together instead of one silently winning.
 *
 * @param {Array<{cand_gender: string, total: any, passed: any}>} rows
 * @param {"male"|"female"} gender
 * @param {"total"|"passed"} field
 */
const genderFigure = (rows, gender, field) =>
  (rows || [])
    .filter(
      (row) => String(row.cand_gender ?? "").trim().toLowerCase() === gender
    )
    .reduce((sum, row) => sum + (Number(row[field]) || 0), 0);

/**
 * Fields dropped from the registration form. Their columns are still NOT NULL
 * in the database and are read by existing screens (e.g. the Interview Portal
 * shows permanent_city), so new applications write a blank instead.
 */
const RETIRED_FIELDS = [
  "permanent_address",
  "permanent_city",
  "degree_start_date",
  "degree_end_date",
];

/**
 * Send the personalised "application received" email to a new candidate.
 * Runs after the HTTP response so a slow/unavailable SMTP server can never
 * delay or fail an admission. Never throws.
 */
const sendApplicationReceivedEmail = async (candidate) => {
  try {
    if (!candidate || !candidate.cand_email) {
      console.warn(
        `[email] candidate ${candidate?.cand_id} has no email address - skipping confirmation`
      );
      return;
    }

    const [course, center, batch] = await Promise.all([
      candidate.course_id
        ? Course.findByPk(candidate.course_id, {
            attributes: ["course_name", "course_full_name"],
          })
        : null,
      candidate.center_id
        ? Center.findByPk(candidate.center_id, { attributes: ["center_name"] })
        : null,
      candidate.tb_id
        ? TrainingBatch.findByPk(candidate.tb_id, {
            attributes: ["tb_name"],
          })
        : null,
    ]);

    const { subject, text, html } = applicationReceived({
      applicationId: candidate.cand_id,
      name: candidate.cand_name,
      fatherName: candidate.cand_fathername,
      cnic: candidate.cand_cnic,
      phone: candidate.cand_phone,
      gender: candidate.cand_gender,
      courseName: course?.course_full_name || course?.course_name || "",
      centerName: center?.center_name || "",
      // Label, not tb_name - see servec/admissionBatch.js. The form says
      // "Batch 10", so the confirmation must not say "Batch-9".
      batchName: ADMISSION_BATCH_LABEL,
      appliedOn: candidate.cand_apply_date,
    });

    await sendEmailSafe({ to: candidate.cand_email, subject, text, html, priority: true });
  } catch (error) {
    // Confirmation mail is best-effort; the application itself is already saved.
    console.error(
      `[email] could not build/send confirmation for candidate ${candidate?.cand_id}:`,
      error.message
    );
  }
};

// Create Candidate
exports.createCandidate = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const candidateData = req.body;
    const admissionCheck = await validateAdmissionAvailability({
      tb_id: candidateData.tb_id,
      center_id: candidateData.center_id,
      course_id: candidateData.course_id,
      gender: candidateData.cand_gender,
    });

    if (!admissionCheck.allowed) {
      return res.status(400).json({ message: admissionCheck.message });
    }

    // Email confirmation was removed from registration at the program's
    // request. An applicant is no longer asked to prove the address before
    // submitting, so a typo is only caught when the interview call-up
    // bounces. The endpoints that issued the codes are left in the codebase
    // but are no longer mounted - see routes in app.js.

    // Check if candidate already exists for this batch
    const existingCandidate = await Candidate.findOne({
      where: { 
        cand_cnic: candidateData.cand_cnic, 
        tb_id: candidateData.tb_id 
      },
    });
    
    const user_profile_photo = req.file
      ? `/uploads/candidate_photos/${req.file.filename}`
      : null;
    candidateData.cand_photo = user_profile_photo;
    
    if (existingCandidate) {
      return res
        .status(400)
        .json({ message: "You have already applied for this batch" });
    }

    if (!candidateData.where_find_us) {
      return res
        .status(400)
        .json({ message: "Information about where you found us is required" });
    }

    // These are no longer collected on the form, but the columns are still
    // NOT NULL in the database - write blanks so the insert succeeds.
    RETIRED_FIELDS.forEach((field) => {
      if (!candidateData[field]) candidateData[field] = "";
    });

    // Create new candidate
    const newCandidate = await Candidate.create(candidateData);
    res.status(201).json({
      message: "Candidate created successfully",
      candidate: newCandidate,
    });

    // Fire-and-forget: the applicant already has their response.
    sendApplicationReceivedEmail(newCandidate);
  } catch (error) {
    console.error("Candidate creation error:", error);
    res.status(500).json({ message: "Server error during candidate creation" });
  }
};
// Check if Candidate Exists by CNIC
exports.checkCandidateByCnic = async (req, res) => {
  try {
    const { cnic } = req.params;
    const { tb_id } = req.query; // Get batch ID from query parameter

    // If no tb_id provided, return error
    if (!tb_id) {
      return res.status(400).json({ 
        message: "Batch ID (tb_id) is required" 
      });
    }

    const openAdmissionsCount = await AdmissionControl.count({
      where: { tb_id: Number(tb_id) },
    });

    if (!openAdmissionsCount) {
      return res.json({
        success: false,
        admissions_open: false,
        message: "Admissions are currently closed for this batch",
      });
    }

    // Check if already enrolled as a student in this batch
    const studentData = await Student.findOne({
      where: { 
        std_cnic: cnic,
      },
    });
    
    if (studentData) {
      return res.json({
        success: true,
        message:
          "You are already enrolled as a student in Training Batch " +
          studentData.tb_id +
          " with Roll Number: " +
          studentData.std_rollno,
        name: studentData.std_fathername, // Or get name from user table if available
        student_data: true,
      });
    }

    // Check if already applied as a candidate in this batch
    const candidate = await Candidate.findOne({
      where: { 
        cand_cnic: cnic, 
        tb_id: tb_id 
      },
      include: [
        {
          model: Course,
          as: "courses",
          attributes: ["course_name", "course_full_name"],
        },
        {
          model: Center,
          as: "centers",
          attributes: ["center_name"],
        },
      ],
    });

    if (!candidate) {
      return res.json({ 
        success: false,
        message: "Candidate not found" 
      });
    }
    
    res.json({
      success: true,
      message: "You have already applied for this batch",
      name: candidate.cand_name,
      candidate,
      student_data: false,
    });
  } catch (error) {
    console.error("Error checking candidate by CNIC:", error);
    res
      .status(500)
      .json({ message: "Server error checking candidate by CNIC" });
  }
};

// Get Candidate Profile
exports.getCandidateById = async (req, res) => {
  try {
    const candidateId = req.params.id;

    const candidate = await Candidate.findByPk(candidateId, {
      include: [
        {
          model: Course,
          as: "courses",
          attributes: ["course_name", "course_full_name"],
        },
        {
          model: Center,
          as: "centers",
          attributes: ["center_name"],
        },
        {
          model: TrainingBatch,
          as: "training_batches",
          attributes: ["batch_name", "batch_status"],
        },
      ],
    });

    if (!candidate) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    res.json(candidate);
  } catch (error) {
    console.error("Candidate profile fetch error:", error);
    res
      .status(500)
      .json({ message: "Server error fetching candidate profile" });
  }
};
exports.getAllSelectedCandidates = async (req, res) => {
  try {
    const { tb_id } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Add tb_id filter to all queries
    const whereClause = {
      tb_id: tb_id,
      [Op.and]: [
        { cand_interview_marks: { [Op.ne]: null } },
        { cand_interview_marks: { [Op.ne]: "" } },
      ], // Only get candidates with interview marks
    };
    // Get candidate info
    const candidate = await Candidate.findOne({
      where: whereClause,
      attributes: ["cand_name", "cand_id", "cand_cnic"],
    });
    const candidateAttributes = await Candidate.findAll({
      where: whereClause,
      include: [
        {
          model: Course,
          as: "courses",
          attributes: ["course_name", "course_full_name"],
        },
        {
          model: Center,
          as: "centers",
          attributes: ["center_name"],
        },
      ],
    });
    // Get all statistics
    const [
      totalCandidates,
      passedCandidates,
      failedCandidates,
      notAttempted,
      rejectedCandidates,
      appliedToday,
      interviewsTaken,
      recommendedCount,
      notRecommendedCount,
      rejectedCount,
      laptopCount,
      noLaptopCount,
    ] = await Promise.all([
      Candidate.count({ where: whereClause }),
      Candidate.count({
        where: { ...whereClause, cand_test_marks: { [Op.gt]: 10 } },
      }),
      Candidate.count({
        where: {
          ...whereClause,
          cand_test_marks: { [Op.gt]: 0, [Op.lte]: 10 },
        },
      }),

      Candidate.count({
        where: {
          ...whereClause,
          // NULL is the normal state before a test is held; "" and "TBD" are
          // the placeholders the portal writes. All three mean "not attempted",
          // and matching only "" made this card read 0 for a whole batch.
          [Op.or]: [
            { cand_test_marks: null },
            { cand_test_marks: "" },
            { cand_test_marks: "TBD" },
          ],
        },
      }),
      Candidate.count({
        where: { ...whereClause, cand_admission_status: 2 },
      }),
      Candidate.count({
        where: {
          ...whereClause,
          [Op.and]: sequelize.where(
            sequelize.fn("DATE", sequelize.col("cand_apply_date")),
            "=",
            sequelize.fn("CURDATE")
          ),
        },
      }),
      Candidate.count({
        where: {
          ...whereClause,
          interview_date: { [Op.ne]: null },
        },
      }),
      Candidate.count({
        where: {
          ...whereClause,
          recommended: "Yes",
        },
      }),
      Candidate.count({
        where: {
          ...whereClause,
          recommended: "No",
        },
      }),
      Candidate.count({
        where: {
          ...whereClause,
          cand_admission_status: 2,
        },
      }),
      Candidate.count({
        where: {
          ...whereClause,
          laptop_pc: "Yes",
        },
      }),
      Candidate.count({
        where: {
          ...whereClause,
          laptop_pc: "No",
        },
      }),
    ]);

    // Gender statistics with tb_id filter
    const genderStats = await Candidate.findAll({
      where: {
        ...whereClause,
        cand_admission_status: { [Op.in]: [1] }, // Added missing closing brace
      },
      attributes: [
        "cand_gender",
        [sequelize.fn("COUNT", sequelize.col("cand_id")), "total"],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal(
              "CASE WHEN cand_admission_status = 1 THEN 1 ELSE 0 END"
            )
          ),
          "passed",
        ],
      ],
      group: ["cand_gender"],
      raw: true,
    });

    // Course summary with tb_id filter
    const courseSummary = await Candidate.findAll({
      where: {
        ...whereClause,
        cand_admission_status: { [Op.in]: [1] }, // Added missing closing brace
      },
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("Candidate.cand_id")), "count"],
        [sequelize.col("courses.course_full_name"), "course_full_name"],
        [sequelize.col("courses.course_name"), "course_name"],
      ],
      include: [
        {
          model: Course,
          as: "courses",
          attributes: [],
        },
      ],
      group: ["courses.course_full_name", "courses.course_name"],
      raw: true,
    });

    // Division summary with tb_id filter
    const divisionSummary = await Candidate.findAll({
      where: {
        ...whereClause,
        cand_admission_status: { [Op.in]: [1] },
        cand_local_domicile: {
          [Op.ne]: null,
        }, // Added missing closing brace
      },

      attributes: [
        "cand_local_domicile",
        [sequelize.fn("COUNT", sequelize.col("cand_id")), "count"],
      ],
      group: ["cand_local_domicile"],
      raw: true,
    });

    // Center summary with tb_id filter
    const centerSummary = await Candidate.findAll({
      where: {
        ...whereClause,
        cand_admission_status: { [Op.in]: [1] }, // Added missing closing brace
      },
      attributes: [
        [sequelize.col("centers.center_name"), "center_name"],
        [sequelize.col("courses.course_name"), "course_name"],
        "cand_gender",
        [sequelize.fn("COUNT", sequelize.col("Candidate.cand_id")), "count"],
      ],
      include: [
        {
          model: Center,
          as: "centers",
          attributes: [],
          required: true,
        },
        {
          model: Course,
          as: "courses",
          attributes: [],
          required: true,
        },
      ],
      group: ["centers.center_name", "courses.course_name", "cand_gender"],
      raw: true,
    });

    // Format center summary
    const formattedCenterSummary = centerSummary.reduce((acc, curr) => {
      const centerName = curr.center_name;
      const courseName = curr.course_name;
      const gender = curr.cand_gender.toLowerCase();
      const count = parseInt(curr.count, 10);

      if (!acc[centerName]) {
        acc[centerName] = {
          total: 0,
          male: 0,
          female: 0,
          courses: {},
        };
      }

      if (!acc[centerName].courses[courseName]) {
        acc[centerName].courses[courseName] = {
          total: 0,
          male: 0,
          female: 0,
        };
      }

      // Update center totals
      acc[centerName].total += count;
      acc[centerName][gender] += count;

      // Update course totals
      acc[centerName].courses[courseName].total += count;
      acc[centerName].courses[courseName][gender] += count;

      return acc;
    }, {});

    const response = {
      candidateInfo: candidate
        ? {
            message: "Candidate found",
            name: candidate.cand_name,
            id: candidate.cand_id,
            cand_cnic: candidate.cand_cnic,
          }
        : { message: "Candidate not found" },
      candidates: candidateAttributes,
      statistics: {
        applicationSummary: {
          totalApplied: totalCandidates,
          passed: passedCandidates,
          failed: failedCandidates,
          testNotAttempted: notAttempted,
          rejected: rejectedCandidates,
          appliedToday: appliedToday,
        },
        interviewSummary: {
          interviewsTaken,
          recommended: recommendedCount,
          notRecommended: notRecommendedCount,
          rejected: rejectedCount,
          haveLaptop: laptopCount,
          noLaptop: noLaptopCount,
        },
        genderSummary: {
          male: {
            total: genderFigure(genderStats, "male", "total"),
            passed: genderFigure(genderStats, "male", "passed"),
          },
          female: {
            total: genderFigure(genderStats, "female", "total"),
            passed: genderFigure(genderStats, "female", "passed"),
          },
        },
        courseSummary: courseSummary.reduce(
          (acc, curr) => ({
            ...acc,
            // Keyed by both names so either lookup resolves. The frontend
            // treats them as aliases of one course, not two separate rows.
            [curr.course_name]: Number(curr.count) || 0,
            [curr.course_full_name]: Number(curr.count) || 0,
          }),
          {}
        ),
        divisionSummary: divisionSummary.reduce(
          (acc, curr) => ({
            ...acc,
            [curr.cand_local_domicile]: Number(curr.count),
          }),
          {}
        ),
        centerSummary: formattedCenterSummary,
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Error checking candidate by CNIC:", error);
    res
      .status(500)
      .json({ message: "Server error checking candidate by CNIC" });
  }
};

// Get All Candidates
exports.getAllCandidates = async (req, res) => {
  try {
    const { tb_id } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Add tb_id filter to all queries
    const whereClause = { tb_id: tb_id };

    // Get candidate info
    const candidate = await Candidate.findOne({
      where: whereClause,
      attributes: ["cand_name", "cand_id", "cand_cnic"],
    });
    const candidateAttributes = await Candidate.findAll({
      where: whereClause,
      include: [
        {
          model: Course,
          as: "courses",
          attributes: ["course_name", "course_full_name"],
        },
        {
          model: Center,
          as: "centers",
          attributes: ["center_name"],
        },
      ],
    });
    // Get all statistics
    const [
      totalCandidates,
      passedCandidates,
      failedCandidates,
      notAttempted,
      rejectedCandidates,
      appliedToday,
    ] = await Promise.all([
      Candidate.count({ where: whereClause }),
      Candidate.count({
        where: { ...whereClause, cand_test_marks: { [Op.gt]: 10 } },
      }),
      Candidate.count({
        where: {
          ...whereClause,
          cand_test_marks: { [Op.gt]: 0, [Op.lte]: 10 },
        },
      }),

      Candidate.count({
        where: {
          ...whereClause,
          // NULL is the normal state before a test is held; "" and "TBD" are
          // the placeholders the portal writes. All three mean "not attempted",
          // and matching only "" made this card read 0 for a whole batch.
          [Op.or]: [
            { cand_test_marks: null },
            { cand_test_marks: "" },
            { cand_test_marks: "TBD" },
          ],
        },
      }),
      Candidate.count({
        where: { ...whereClause, cand_admission_status: 2 },
      }),
      Candidate.count({
        where: {
          ...whereClause,
          [Op.and]: sequelize.where(
            sequelize.fn("DATE", sequelize.col("cand_apply_date")),
            "=",
            sequelize.fn("CURDATE")
          ),
        },
      }),
    ]);

    // Gender statistics with tb_id filter
    const genderStats = await Candidate.findAll({
      where: whereClause,
      attributes: [
        "cand_gender",
        [sequelize.fn("COUNT", sequelize.col("cand_id")), "total"],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal(
              "CASE WHEN cand_admission_status = 1 THEN 1 ELSE 0 END"
            )
          ),
          "passed",
        ],
      ],
      group: ["cand_gender"],
      raw: true,
    });

    // Course summary with tb_id filter
    const courseSummary = await Candidate.findAll({
      where: whereClause,
      attributes: [
        [sequelize.fn("COUNT", sequelize.col("Candidate.cand_id")), "count"],
        [sequelize.col("courses.course_full_name"), "course_full_name"],
        [sequelize.col("courses.course_name"), "course_name"],
      ],
      include: [
        {
          model: Course,
          as: "courses",
          attributes: [],
        },
      ],
      group: ["courses.course_full_name", "courses.course_name"],
      raw: true,
    });

    // Division summary with tb_id filter
    const divisionSummary = await Candidate.findAll({
      where: {
        ...whereClause,
        cand_local_domicile: {
          [Op.ne]: null,
        },
      },
      attributes: [
        "cand_local_domicile",
        [sequelize.fn("COUNT", sequelize.col("cand_id")), "count"],
      ],
      group: ["cand_local_domicile"],
      raw: true,
    });

    // Center summary with tb_id filter
    const centerSummary = await Candidate.findAll({
      where: whereClause,
      attributes: [
        [sequelize.col("centers.center_name"), "center_name"],
        [sequelize.col("courses.course_name"), "course_name"],
        "cand_gender",
        [sequelize.fn("COUNT", sequelize.col("Candidate.cand_id")), "count"],
      ],
      include: [
        {
          model: Center,
          as: "centers",
          attributes: [],
          required: true,
        },
        {
          model: Course,
          as: "courses",
          attributes: [],
          required: true,
        },
      ],
      group: ["centers.center_name", "courses.course_name", "cand_gender"],
      raw: true,
    });

    // Format center summary
    const formattedCenterSummary = centerSummary.reduce((acc, curr) => {
      const centerName = curr.center_name;
      const courseName = curr.course_name;
      const gender = curr.cand_gender.toLowerCase();
      const count = parseInt(curr.count, 10);

      if (!acc[centerName]) {
        acc[centerName] = {
          total: 0,
          male: 0,
          female: 0,
          courses: {},
        };
      }

      if (!acc[centerName].courses[courseName]) {
        acc[centerName].courses[courseName] = {
          total: 0,
          male: 0,
          female: 0,
        };
      }

      // Update center totals
      acc[centerName].total += count;
      acc[centerName][gender] += count;

      // Update course totals
      acc[centerName].courses[courseName].total += count;
      acc[centerName].courses[courseName][gender] += count;

      return acc;
    }, {});

    const response = {
      candidateInfo: candidate
        ? {
            message: "Candidate found",
            name: candidate.cand_name,
            id: candidate.cand_id,
            cand_cnic: candidate.cand_cnic,
          }
        : { message: "Candidate not found" },
      candidates: candidateAttributes,
      statistics: {
        applicationSummary: {
          totalApplied: totalCandidates,
          passed: passedCandidates,
          failed: failedCandidates,
          testNotAttempted: notAttempted,
          rejected: rejectedCandidates,
          appliedToday: appliedToday,
        },
        genderSummary: {
          male: {
            total: genderFigure(genderStats, "male", "total"),
            passed: genderFigure(genderStats, "male", "passed"),
          },
          female: {
            total: genderFigure(genderStats, "female", "total"),
            passed: genderFigure(genderStats, "female", "passed"),
          },
        },
        courseSummary: courseSummary.reduce(
          (acc, curr) => ({
            ...acc,
            // Keyed by both names so either lookup resolves. The frontend
            // treats them as aliases of one course, not two separate rows.
            [curr.course_name]: Number(curr.count) || 0,
            [curr.course_full_name]: Number(curr.count) || 0,
          }),
          {}
        ),
        divisionSummary: divisionSummary.reduce(
          (acc, curr) => ({
            ...acc,
            [curr.cand_local_domicile]: Number(curr.count),
          }),
          {}
        ),
        centerSummary: formattedCenterSummary,
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Error checking candidate by CNIC:", error);
    res
      .status(500)
      .json({ message: "Server error checking candidate by CNIC" });
  }
};

// Update Candidate
exports.updateCandidate = async (req, res) => {
  try {
    const candidateId = req.params.id;
    const updateData = req.body;

    // Validate where_find_us if it is being updated
    if (updateData.where_find_us === "") {
      return res.status(400).json({
        message: "Information about where you found us cannot be empty",
      });
    }

    const [updatedRowsCount] = await Candidate.update(updateData, {
      where: { cand_id: candidateId },
    });

    if (updatedRowsCount === 0) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    const updatedCandidate = await Candidate.findByPk(candidateId);

    res.json({
      message: "Candidate updated successfully",
      candidate: updatedCandidate,
    });
  } catch (error) {
    console.error("Candidate update error:", error);
    res.status(500).json({ message: "Server error updating candidate" });
  }
};

// Update Admission Status
exports.updateAdmissionStatus = async (req, res) => {
  try {
    const candidateId = req.params.id;
    const { cand_admission_status, reject_reason } = req.body;

    const [updatedRowsCount] = await Candidate.update(
      {
        cand_admission_status,
        reject_reason: reject_reason || "",
      },
      { where: { cand_id: candidateId } }
    );

    if (updatedRowsCount === 0) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    res.json({
      message: "Admission status updated successfully",
    });
  } catch (error) {
    console.error("Admission status update error:", error);
    res.status(500).json({ message: "Server error updating admission status" });
  }
};

// Update Interview Marks
exports.updateInterviewMarks = async (req, res) => {
  try {
    const candidateId = req.params.id;
    const { cand_interview_marks, interview_date } = req.body;

    const [updatedRowsCount] = await Candidate.update(
      {
        cand_interview_marks,
        interview_date,
      },
      { where: { cand_id: candidateId } }
    );

    if (updatedRowsCount === 0) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    res.json({
      message: "Interview marks updated successfully",
    });
  } catch (error) {
    console.error("Interview marks update error:", error);
    res.status(500).json({ message: "Server error updating interview marks" });
  }
};

// Update Test Marks
exports.updateTestMarks = async (req, res) => {
  try {
    const candidateId = req.params.id;
    const { cand_test_code, cand_test_marks } = req.body;

    const [updatedRowsCount] = await Candidate.update(
      {
        cand_test_code,
        cand_test_marks,
      },
      { where: { cand_id: candidateId } }
    );

    if (updatedRowsCount === 0) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    res.json({
      message: "Test marks updated successfully",
    });
  } catch (error) {
    console.error("Test marks update error:", error);
    res.status(500).json({ message: "Server error updating test marks" });
  }
};

// Update Interview Data
exports.updateInterviewData = async (req, res) => {
  try {
    const { candidateId } = req.params;
    const {
      cand_interview_marks,
      hasLaptop,
      isRecommended,
      courseTrack,
      isUobStudent,
    } = req.body;

    const updateFields = {
      cand_interview_marks,
      laptop_pc: hasLaptop ? "Yes" : "No", // Store as string 'Yes' or 'No'
      recommended: isRecommended ? "Yes" : "No", // Store as string 'Yes' or 'No'
      course_second_priority: courseTrack || null,
      interview_date: new Date().toISOString().split("T")[0], // Format as YYYY-MM-DD string
      cand_admission_status: isRecommended ? 1 : 0, // 1 for passed/recommended
    };

    // Center (2nd priority) was removed from the interview form, so it is no
    // longer written here - existing values on old records are left as-is.

    // Only write the UoB flag when the interviewer actually answered, so
    // "never asked" (NULL) stays distinguishable from an explicit "No".
    if (isUobStudent === true || isUobStudent === false) {
      updateFields.is_uob_student = isUobStudent;
    }

    const [updatedRowsCount] = await Candidate.update(updateFields, {
      where: { cand_id: candidateId },
    });

    if (updatedRowsCount === 0) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    res.json({
      success: true,
      message: "Interview data updated successfully",
    });
  } catch (error) {
    console.error("Interview data update error:", error);
    res.status(500).json({ message: "Server error updating interview data" });
  }
};

/**
 * Change a candidate's center and/or course before they are enrolled.
 *
 * Restricted to candidates on purpose: once a student is enrolled their
 * attendance rows are tied to the old center/course, so moving them would
 * leave historical percentages pointing at the wrong class.
 *
 * SuperAdmin only - enforced on the route.
 */
exports.changeCandidateCenterOrCourse = async (req, res) => {
  try {
    const { cand_id } = req.params;
    const { center_id, course_id, reason } = req.body;

    if (!center_id && !course_id) {
      return res
        .status(400)
        .json({ success: false, message: "Provide a new center and/or course" });
    }

    const candidate = await Candidate.findByPk(cand_id);
    if (!candidate) {
      return res.status(404).json({ success: false, message: "Candidate not found" });
    }

    // Refuse once the candidate has become a student - use the student record
    // instead, so attendance history stays consistent.
    const enrolled = await Student.findOne({
      where: { std_cnic: candidate.cand_cnic, tb_id: candidate.tb_id },
      attributes: ["std_id", "std_rollno"],
      raw: true,
    });

    if (enrolled) {
      return res.status(409).json({
        success: false,
        message: `This candidate is already enrolled as ${enrolled.std_rollno}. Enrolled students cannot be moved from here.`,
      });
    }

    const previous = {
      center_id: candidate.center_id,
      course_id: candidate.course_id,
    };

    const updates = {};
    if (center_id) updates.center_id = center_id;
    if (course_id) updates.course_id = course_id;

    // The target center/course must actually be open for this batch and gender.
    const check = await validateAdmissionAvailability({
      tb_id: candidate.tb_id,
      center_id: updates.center_id ?? candidate.center_id,
      course_id: updates.course_id ?? candidate.course_id,
      gender: candidate.cand_gender,
    });

    if (!check.allowed) {
      return res.status(400).json({ success: false, message: check.message });
    }

    await candidate.update(updates);

    const [newCenter, newCourse] = await Promise.all([
      Center.findByPk(candidate.center_id, { attributes: ["center_name"] }),
      Course.findByPk(candidate.course_id, {
        attributes: ["course_name", "course_full_name"],
      }),
    ]);

    console.log(
      `[candidate-change] cand ${cand_id}: center ${previous.center_id} -> ${candidate.center_id}, course ${previous.course_id} -> ${candidate.course_id} by user ${req.user.id} (${req.user.username})${reason ? ` reason: ${reason}` : ""}`
    );

    return res.json({
      success: true,
      message: "Candidate center/course updated",
      candidate: {
        cand_id: candidate.cand_id,
        cand_name: candidate.cand_name,
        cand_cnic: candidate.cand_cnic,
        center_id: candidate.center_id,
        course_id: candidate.course_id,
        center_name: newCenter?.center_name || "",
        course_name: newCourse?.course_full_name || newCourse?.course_name || "",
      },
      previous,
    });
  } catch (error) {
    console.error("Candidate center/course change error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error updating candidate" });
  }
};

// Suspend Candidate
exports.suspendCandidate = async (req, res) => {
  try {
    const { candidateId } = req.params;
    const { rejectReason } = req.body;

    const [updatedRowsCount] = await Candidate.update(
      {
        cand_admission_status: 2, // 2 for rejected/suspended
        reject_reason: rejectReason || "No reason provided",
      },
      { where: { cand_id: candidateId } }
    );

    if (updatedRowsCount === 0) {
      return res.status(404).json({ message: "Candidate not found" });
    }

    res.json({
      success: true,
      message: "Candidate suspended successfully",
    });
  } catch (error) {
    console.error("Candidate suspension error:", error);
    res.status(500).json({ message: "Server error suspending candidate" });
  }
};
