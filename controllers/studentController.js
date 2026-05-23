const Student = require("../models/studentModel");
const Center = require("../models/center");
const Course = require("../models/course");
const TrainingBatch = require("../models/trainingBatcheModel");
const Trainer = require("../models/trainersModel");
const TrainerCenterAllocation = require("../models/trainersCenterAllocationModel");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const { sequelize } = require("../config/db");
const MasterTrainer = require("../models/masterTrainersModel");
const CenterDates = require("../models/centersDatesModel");
const Attendance = require("../models/attendanceModel");
const sendEmail = require("../servec/emailConfig"); // Make sure you have a sendEmail utility
const Earning = require("../models/earningsModel");
const CenterManager = require("../models/centerUsersModel");
const HolidayDates = require("../models/holidaysModel");
exports.registerStudent = async (req, res) => {
  const transaction = await sequelize.transaction(); // Initialize transaction
  try {
    const {
      std_rollno,
      std_cnic,
      user_name,
      user_username,
      std_fathername,
      std_gender,
      std_qualification,
      std_district,
      user_email,
      std_phone,
      user_password,
      course_id,
      center_id,
      tb_id,
      dark_mode,
      special_case,
      special_case_comments,
    } = req.body;
    const existingTrainer = await User.findOne({
      where: {
        user_email,
        user_username,
      },
    });
    if (existingTrainer) {
      return res.status(400).json({ message: "Student already exists" });
    }
    // Process profile photo
    const user_profile_photo = req.file
      ? `/uploads/user-profiles/${req.file.filename}`
      : null;

    // Create new User
    const newUser = await User.create(
      {
        user_name: user_name.trim(),
        user_email: user_email.toLowerCase(),
        user_password: "",
        user_username: user_username.trim(),
        user_profile_photo,
        user_type: "student",
        user_status: 1,
      },
      { transaction } // Pass the transaction
    );

    // Create new Student
    const newStudent = await Student.create(
      {
        std_rollno,
        std_cnic,
        std_fathername,
        std_gender,
        std_qualification,
        std_district,
        std_phone,
        user_id: newUser.user_id,
        course_id,
        center_id,
        tb_id,
        dark_mode: dark_mode || 0,
        special_case: special_case || 0,
        special_case_comments: special_case_comments || "",
        std_added_on: new Date().toISOString().split("T")[0],
        std_lms_status: 1,
        std_forum_status: 1,
      },
      { transaction } // Pass the transaction
    );

    const token = jwt.sign(
      {
        id: newUser.user_id,
        type: newUser.user_type,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // Commit transaction
    await transaction.commit();
    // Send email with the verification code
    await sendEmail(
      user_email,
      "Welcome to DigiBizz LMS",
      `You are part of the DIGIBIZZ training. Kindly create your account in the DIGIBIZZ LMS and start your learning journey together.`,
      `<p>You are part of the DIGIBIZZ training. Kindly create your account in the DIGIBIZZ LMS and start your learning journey together.</p>`
    );
    // Send success response
    res.status(201).json({
      status: "success",
      message: "Student registered successfully",
      token,
      student: {
        id: newStudent.std_id,
        name: newUser.user_name,
        email: newUser.user_email,
        centerId: newStudent.center_id,
        courseId: newStudent.course_id,
        trainingBatchId: newStudent.tb_id,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Student registration error:", error);

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        status: "error",
        message: "A student with this information already exists",
      });
    }

    if (error.name === "SequelizeValidationError") {
      return res.status(400).json({
        status: "error",
        message: "Invalid input data",
        errors: error.errors.map((err) => ({
          field: err.path,
          message: err.message,
        })),
      });
    }

    res.status(500).json({
      status: "error",
      message: "Server error during registration",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
// Helper function to fetch student statistics in BULK (highly optimized)
const fetchBulkStudentStatistics = async (students, tb_id, batchEndDate) => {
  try {
    if (!students || students.length === 0) {
      return {};
    }

    const studentCNICs = students.map(s => s.std_cnic);
    const studentRollNos = students.map(s => s.std_rollno);
    
    // Fetch ALL data in parallel bulk queries
    const [
      ticketCounts,
      feedbackCounts,
      documents,
      professionalProfiles,
      attendanceRecords,
      holidays,
      centerDates
    ] = await Promise.all([
      // Bulk ticket counts
      sequelize.query(
        `SELECT std_rollno, COUNT(*) as count FROM tickets 
         WHERE std_rollno IN (:rollnos) GROUP BY std_rollno`,
        {
          replacements: { rollnos: studentRollNos },
          type: sequelize.QueryTypes.SELECT,
        }
      ),
      // Bulk feedback counts
      sequelize.query(
        `SELECT std_rollno, COUNT(*) as count FROM students_feedback 
         WHERE std_rollno IN (:rollnos) GROUP BY std_rollno`,
        {
          replacements: { rollnos: studentRollNos },
          type: sequelize.QueryTypes.SELECT,
        }
      ),
      // Bulk documents
      sequelize.query(
        `SELECT * FROM students_docs WHERE std_cnic IN (:cnics)`,
        {
          replacements: { cnics: studentCNICs },
          type: sequelize.QueryTypes.SELECT,
        }
      ),
      // Bulk professional profiles
      sequelize.query(
        `SELECT * FROM students_freelancing_profiles WHERE std_cnic IN (:cnics)`,
        {
          replacements: { cnics: studentCNICs },
          type: sequelize.QueryTypes.SELECT,
        }
      ),
      // Bulk attendance records
      Attendance.findAll({
        where: {
          std_cnic: { [Op.in]: studentCNICs },
          tb_id: tb_id,
        },
        attributes: ["std_cnic", "attend_status", "attend_date"],
        raw: true,
      }),
      // Bulk holidays
      HolidayDates.findAll({
        where: { 
          tb_id: tb_id,
        },
        attributes: ["h_date", "center_id"],
        raw: true,
      }),
      // Bulk center dates
      sequelize.query(
        `SELECT center_id, tb_start, tb_end FROM centers_dates 
         WHERE tb_id = :tb_id`,
        {
          replacements: { tb_id },
          type: sequelize.QueryTypes.SELECT,
        }
      )
    ]);

    // Create lookup maps for O(1) access
    const ticketMap = new Map(ticketCounts.map(t => [t.std_rollno, t.count]));
    const feedbackMap = new Map(feedbackCounts.map(f => [f.std_rollno, f.count]));
    const documentsMap = new Map();
    const profilesMap = new Map();
    const attendanceMap = new Map();
    const centerDatesMap = new Map(centerDates.map(cd => [cd.center_id, cd]));
    
    // Group documents by CNIC
    documents.forEach(doc => {
      if (!documentsMap.has(doc.std_cnic)) {
        documentsMap.set(doc.std_cnic, []);
      }
      documentsMap.get(doc.std_cnic).push(doc);
    });
    
    // Group profiles by CNIC
    professionalProfiles.forEach(profile => {
      if (!profilesMap.has(profile.std_cnic)) {
        profilesMap.set(profile.std_cnic, []);
      }
      profilesMap.get(profile.std_cnic).push(profile);
    });
    
    // Group attendance by CNIC
    attendanceRecords.forEach(record => {
      if (!attendanceMap.has(record.std_cnic)) {
        attendanceMap.set(record.std_cnic, new Map());
      }
      const normalizeDate = (date) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
      };
      const dateStr = normalizeDate(new Date(record.attend_date)).toISOString().split("T")[0];
      attendanceMap.get(record.std_cnic).set(dateStr, record.attend_status.toUpperCase());
    });
    
    // Create holiday sets by center
    const holidaysByCenter = new Map();
    const globalHolidays = new Set();
    
    holidays.forEach(h => {
      const normalizeDate = (date) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
      };
      const dateStr = normalizeDate(new Date(h.h_date)).toISOString().split("T")[0];
      
      if (h.center_id === null) {
        globalHolidays.add(dateStr);
      } else {
        if (!holidaysByCenter.has(h.center_id)) {
          holidaysByCenter.set(h.center_id, new Set());
        }
        holidaysByCenter.get(h.center_id).add(dateStr);
      }
    });

    // Calculate attendance for each student
    const statsMap = {};
    
    students.forEach(student => {
      let attendanceProgress = 0;
      
      try {
        const centerDatesResult = centerDatesMap.get(student.center_id);
        
        let startDate = null;
        if (student.std_added_on) {
          startDate = new Date(student.std_added_on);
        } else if (centerDatesResult && centerDatesResult.tb_start) {
          startDate = new Date(centerDatesResult.tb_start);
        }

        let endDate = null;
        if (centerDatesResult && centerDatesResult.tb_end) {
          endDate = new Date(centerDatesResult.tb_end);
        }

        if (startDate && endDate) {
          const normalizeDate = (date) => {
            const d = new Date(date);
            d.setHours(0, 0, 0, 0);
            return d;
          };

          startDate = normalizeDate(startDate);
          endDate = normalizeDate(endDate);
          const currentDate = normalizeDate(new Date());

          const studentAttendanceMap = attendanceMap.get(student.std_cnic) || new Map();
          const centerHolidays = holidaysByCenter.get(student.center_id) || new Set();
          const allHolidays = new Set([...globalHolidays, ...centerHolidays]);

          const effectiveEndDate = currentDate < endDate ? currentDate : endDate;

          let totalWorkingDays = 0;
          let presentDays = 0;

          for (
            let date = new Date(startDate);
            date <= effectiveEndDate;
            date.setDate(date.getDate() + 1)
          ) {
            const dayOfWeek = date.getDay();
            const dateStr = date.toISOString().split("T")[0];
            
            if (dayOfWeek === 0 || dayOfWeek === 6) {
              continue;
            }

            totalWorkingDays++;

            const isHoliday = allHolidays.has(dateStr);
            const attendStatus = studentAttendanceMap.get(dateStr);

            if (isHoliday || attendStatus === 'P' || attendStatus === 'L') {
              presentDays++;
            }
          }

          attendanceProgress = Math.min(
            totalWorkingDays > 0
              ? Math.round((presentDays / totalWorkingDays) * 100)
              : 0,
            100
          );
        }
      } catch (attendanceError) {
        console.error(`Error calculating attendance for ${student.std_cnic}:`, attendanceError);
        attendanceProgress = 0;
      }
      
      statsMap[student.std_cnic] = {
        attendanceProgress,
        tickets: {
          count: ticketMap.get(student.std_rollno) || 0,
        },
        feedback: {
          submissionCount: feedbackMap.get(student.std_rollno) || 0,
        },
        documents: documentsMap.get(student.std_cnic) || [],
        professionalProfiles: profilesMap.get(student.std_cnic) || [],
      };
    });
    
    return statsMap;
  } catch (error) {
    console.error("Error fetching bulk student statistics:", error);
    return {};
  }
};

// Legacy helper function for single student (uses bulk function internally)
const fetchStudentStatistics = async (student, tb_id, batchEndDate) => {
  try {
    const statsMap = await fetchBulkStudentStatistics([student], tb_id, batchEndDate);
    const baseStats = statsMap[student.std_cnic] || {
      attendanceProgress: 0,
      tickets: { count: 0 },
      feedback: { submissionCount: 0 },
      documents: [],
      professionalProfiles: [],
    };

    const batchId = student.tb_id || tb_id;

    if (!batchId) {
      return baseStats;
    }

    const assignments = await sequelize.query(
      `
      SELECT
        a.as_id,
        a.as_title,
        a.as_deadline,
        a.as_marks,
        a.as_added_on
      FROM assignments AS a
      WHERE a.tb_id = :tb_id
        AND a.center_id = :center_id
        AND a.course_id = :course_id
      `,
      {
        replacements: {
          tb_id: batchId,
          center_id: student.center_id,
          course_id: student.course_id,
        },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    const completedAssignments = await sequelize.query(
      `
      SELECT
        a.as_id,
        a.as_title,
        s.submitted_on,
        s.obt_marks,
        a.as_marks,
        s.as_submission_status
      FROM assignment_submissions AS s
      JOIN assignments AS a ON s.as_id = a.as_id
      WHERE s.std_rollno = :std_rollno
        AND s.tb_id = :tb_id
        AND s.as_submission_status <> 2
      `,
      {
        replacements: {
          std_rollno: student.std_rollno,
          tb_id: batchId,
        },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    const completedAssignmentIds = completedAssignments.map((assignment) => assignment.as_id);
    const missedAssignments = assignments.filter(
      (assignment) =>
        !completedAssignmentIds.includes(assignment.as_id) &&
        new Date(assignment.as_deadline) < new Date()
    );

    const assignmentProgress = {
      total: assignments.length,
      completed: completedAssignments.length,
      missed: missedAssignments.length,
      pending:
        assignments.length -
        completedAssignments.length -
        missedAssignments.length,
      completionRate:
        assignments.length > 0
          ? Math.round((completedAssignments.length / assignments.length) * 100)
          : 0,
    };

    return {
      ...baseStats,
      assignments: {
        received: assignments,
        completed: completedAssignments,
        missed: missedAssignments,
        progress: assignmentProgress,
      },
    };
  } catch (error) {
    console.error("Error fetching student statistics:", error);
    return {
      attendanceProgress: 0,
      assignments: {
        received: [],
        completed: [],
        missed: [],
        progress: {
          total: 0,
          completed: 0,
          missed: 0,
          pending: 0,
          completionRate: 0,
        },
      },
      tickets: { count: 0 },
      feedback: { submissionCount: 0 },
      documents: [],
      professionalProfiles: [],
    };
  }
};

// Get Student Profile
exports.getStudentProfile = async (req, res) => {
  const { tb_id, center_id, course_id, user_id, userType, date } = req.query;
  let t_center_ids = [];
  let t_course_ids = [];
  let whereClause;
  
  // Validate required parameters
  if (!tb_id) {
    return res.status(400).json({
      success: false,
      message: "Training batch ID (tb_id) is required",
    });
  }

  try {
    if (userType === "trainer") {
      const trainer = await Trainer.findOne({ where: { user_id } });

      if (!trainer) {
        return res.status(404).json({
          success: false,
          message: "Trainer not found",
        });
      }

      const trainerCenters = await TrainerCenterAllocation.findAll({
        where: { t_id: trainer.t_id, tb_id },
      });

      if (!trainerCenters || trainerCenters.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No centers allocated to this trainer",
        });
      }

      t_center_ids = trainerCenters.map((center) => center.center_id);
      t_course_ids = trainerCenters.map((center) => center.course_id);

      // Build WHERE clause safely with proper checks for empty arrays
      if (t_center_ids.length > 0 && t_course_ids.length > 0) {
        whereClause = `WHERE u.user_type = 'Student'
          AND s.tb_id = ${tb_id}
          AND s.center_id IN (${t_center_ids.join(",")})
          AND s.course_id IN (${t_course_ids.join(",")})`;
      } else {
        whereClause = `WHERE u.user_type = 'Student'
          AND s.tb_id = ${tb_id}`;
      }
    } else if (userType === "MasterTrainer") {
      const masterTrainer = await MasterTrainer.findOne({ where: { user_id } });

      if (!masterTrainer) {
        return res.status(404).json({
          success: false,
          message: "Master Trainer not found",
        });
      }

      // Check if mt_course_id is defined before using it in the query
      if (masterTrainer.mt_course_id) {
        whereClause = `WHERE u.user_type = 'Student'
          AND s.tb_id = ${tb_id}
          AND s.course_id = ${masterTrainer.mt_course_id}`;
      } else {
        whereClause = `WHERE u.user_type = 'Student'
          AND s.tb_id = ${tb_id}`;
      }
    } else if (userType === "Center Manager") {
      const centerManager = await CenterManager.findOne({ where: { user_id } });
      if (!centerManager) {
        return res.status(404).json({
          success: false,
          message: "Center Manager not found",
        });
      }
      whereClause = `WHERE u.user_type = 'Student'
          AND s.tb_id = ${tb_id}
          AND s.center_id = ${centerManager.center_id}`;
    } else {
      // Default case for admin or other user types
      whereClause = `WHERE u.user_type = 'Student'
        AND s.tb_id = ${tb_id}`;

      // Add optional filters if provided
      if (center_id) {
        whereClause += ` AND s.center_id = ${center_id}`;
      }
      if (course_id) {
        whereClause += ` AND s.course_id = ${course_id}`;
      }
    }

    // Query to fetch student data - ENSURE tb_id is included
    const query = `
      SELECT 
        u.user_id,
        u.user_name,
        u.user_username,
        u.user_email,
        u.user_profile_photo,
        u.user_password,
        u.user_type,
        u.user_status,
        s.std_rollno,
        s.std_cnic,
        s.std_gender,
        s.std_fathername,
        s.std_qualification,
        s.std_district,
        s.std_phone,
        s.course_id,
        s.center_id,
        s.tb_id,
        s.std_added_on,
        s.std_lms_status,
        s.std_forum_status,
        s.special_case,
        s.special_case_comments,
        c.course_name,
        c.course_full_name,
        c.course_status,
        ce.center_name,
        e.total_earnings,
        e.latest_earning_date,
        e.earning_platforms,
        e.earning_statuses,
       CASE 
      WHEN sl.sl_date = CURDATE() AND sl.sl_status = 1 THEN TRUE
      ELSE FALSE
    END AS has_leave_today,
    CASE 
      WHEN sl.sl_date = CURDATE() THEN sl.sl_date
      ELSE NULL
    END AS leave_date
      FROM 
        user AS u
      LEFT JOIN 
        students AS s ON u.user_id = s.user_id
      LEFT JOIN 
        courses AS c ON s.course_id = c.course_id
      LEFT JOIN 
        centers AS ce ON s.center_id = ce.center_id
      LEFT JOIN 
        students_leaves AS sl ON s.std_cnic = sl.std_cnic AND sl.sl_date = CURDATE()
      LEFT JOIN (
        SELECT 
          std_id,
          SUM(earning_amount) as total_earnings,
          MAX(earning_date) as latest_earning_date,
          GROUP_CONCAT(DISTINCT earning_platform) as earning_platforms,
          GROUP_CONCAT(earning_status) as earning_statuses
        FROM earnings
        GROUP BY std_id
      ) AS e ON s.std_id = e.std_id
      ${whereClause}`;

    const rows = await sequelize.query(query, {
      type: sequelize.QueryTypes.SELECT
    });

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No students found",
      });
    }

    // Fetch training batch details once (including tb_end date)
    const trainingBatch = await TrainingBatch.findOne({ 
      where: { tb_id },
      attributes: ["tb_id", "tb_name", "tb_end"],
      raw: true 
    });

    const batchEndDate = trainingBatch ? trainingBatch.tb_end : null;

    // OPTIMIZED: Fetch ALL student statistics in ONE bulk operation
    const statsMap = await fetchBulkStudentStatistics(rows, tb_id, batchEndDate);

    // Prepare enhanced student data - now just mapping without async calls
    const enhancedStudentData = rows.map((student) => {
      // Get statistics from pre-fetched map
      const studentStats = statsMap[student.std_cnic] || {
        attendanceProgress: 0,
        tickets: { count: 0 },
        feedback: { submissionCount: 0 },
        documents: [],
        professionalProfiles: [],
      };

      return {
        user_id: student.user_id,
        user_profile_photo: student.user_profile_photo,
        std_rollno: student.std_rollno,
        std_cnic: student.std_cnic,
        user_name: student.user_name,
        user_username: student.user_username,
        std_fathername: student.std_fathername || "",
        std_gender: student.std_gender || "Male",
        std_qualification: student.std_qualification || "",
        std_district: student.std_district || "",
        user_email: student.user_email,
        std_phone: student.std_phone || "",
        user_type: student.user_type,
        course_id: student.course_id,
        center_id: student.center_id,
        t_id: 0, // Placeholder value
        tb_id: student.tb_id || tb_id, // Ensure tb_id is included from student object or query parameter
        user_status: student.user_status === "Active" ? 1 : 0,
        dark_mode: "0", // Placeholder value
        special_case: student.special_case || 0,
        special_case_comments: student.special_case_comments || "",
        course_name: student.course_name,
        course_full_name: student.course_full_name,
        course_status: student.course_status,
        center_name: student.center_name,
        std_added_on: student.std_added_on,
        std_lms_status: student.std_lms_status,
        t_name: trainingBatch ? trainingBatch.tb_name : null,
        student_cnic: student.std_cnic,
        ...studentStats, // Add all the statistics from the helper function
        earnings: student.total_earnings || 0,
        earning_date: student.latest_earning_date || null,
        earning_platforms: student.earning_platforms
          ? student.earning_platforms.split(",")
          : [],
        earning_statuses: student.earning_statuses
          ? student.earning_statuses.split(",").map(Number)
          : [],
        has_leave_today: student.has_leave_today || false,
        leave_date: student.leave_date || null,
      };
    });

    return res.status(200).json({
      success: true,
      data: enhancedStudentData,
    });
  } catch (error) {
    console.error("Error fetching student profile:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error fetching profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const getStudentProfileByField = async (res, fieldClause, replacements) => {
  try {
    const [student] = await sequelize.query(
      `
      SELECT 
        u.user_id,
        u.user_name,
        u.user_username,
        u.user_email,
        u.user_profile_photo,
        u.user_type,
        u.user_status,
        u.user_password,
        s.std_id,
        s.std_rollno,
        s.std_cnic,
        s.std_gender,
        s.std_fathername,
        s.std_qualification,
        s.std_district,
        s.std_phone,
        s.course_id,
        s.center_id,
        s.tb_id,
        s.std_added_on,
        s.std_lms_status,
        s.std_forum_status,
        s.suspension_reason,
        c.course_name,
        c.course_full_name,
        c.course_status,
        ce.center_name
      FROM 
        user AS u
      INNER JOIN 
        students AS s ON u.user_id = s.user_id
      LEFT JOIN 
        courses AS c ON s.course_id = c.course_id
      LEFT JOIN 
        centers AS ce ON s.center_id = ce.center_id
      WHERE 
        LOWER(u.user_type) = 'student'
        AND ${fieldClause}
      LIMIT 1
      `,
      {
        replacements,
        type: sequelize.QueryTypes.SELECT,
      }
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Fetch training batch to get end date
    const trainingBatch = await TrainingBatch.findOne({
      where: { tb_id: student.tb_id },
      attributes: ["tb_end"],
      raw: true,
    });

    const batchEndDate = trainingBatch ? trainingBatch.tb_end : null;

    const studentStats = await fetchStudentStatistics(
      student,
      student.tb_id,
      batchEndDate
    );

    const transformedData = {
      user_id: student.user_id,
      user_name: student.user_name,
      user_username: student.user_username,
      user_email: student.user_email,
      user_type: student.user_type,
      user_status: student.user_status,
      user_profile_photo: student.user_profile_photo,
      std_id: student.std_id,
      course_id: student.course_id,
      course_name: student.course_name,
      course_full_name: student.course_full_name,
      course_status: student.course_status,
      std_added_on: student.std_added_on,
      center_name: student.center_name,
      std_cnic: student.std_cnic,
      center_id: student.center_id,
      tb_id: student.tb_id,
      std_gender: student.std_gender,
      std_qualification: student.std_qualification,
      std_district: student.std_district,
      std_phone: student.std_phone,
      std_fathername: student.std_fathername,
      std_lms_status: student.std_lms_status,
      std_forum_status: student.std_forum_status,
      std_rollno: student.std_rollno,
      ...studentStats,
    };
    return res.status(200).json({
      success: true,
      data: transformedData,
    });
  } catch (error) {
    console.error("Error fetching student profile:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get Student Profile By CNIC
exports.getStudentProfileByCNIC = async (req, res) => {
  const { std_cnic } = req.params;

  if (!std_cnic) {
    return res.status(400).json({
      success: false,
      message: "CNIC is required",
    });
  }

  return getStudentProfileByField(res, "s.std_cnic = :std_cnic", {
    std_cnic,
  });
};

exports.getStudentProfileByEmail = async (req, res) => {
  const user_email = req.params.user_email?.trim().toLowerCase();

  if (!user_email) {
    return res.status(400).json({
      success: false,
      message: "Email is required",
    });
  }

  return getStudentProfileByField(res, "LOWER(u.user_email) = :user_email", {
    user_email,
  });
};

// Update Student Profile
exports.updateStudentProfile = async (req, res) => {
  const transaction = await sequelize.transaction(); // Initialize transaction at the start

  try {
    // Find the student
    const student = await Student.findOne({
      where: { std_rollno: req.body.std_rollno },
    });

    if (!student) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    // Update student fields
    const {
      std_fathername,
      std_gender,
      std_cnic,
      std_qualification,
      std_district,
      std_phone,
      course_id,
      center_id,
      tb_id,
      dark_mode,
      special_case,
      special_case_comments,
      std_lms_status,
      std_forum_status,
      // User fields
      user_name,
      user_username,
      user_email,
      user_status,
      user_id,
    } = req.body;

    // Update student record
    await student.update(
      {
        std_fathername,
        std_gender,
        std_qualification,
        std_district,
        std_cnic,
        std_phone,
        course_id: course_id || student.course_id,
        center_id: center_id || student.center_id,
        tb_id: tb_id || student.tb_id,
        dark_mode: dark_mode !== undefined ? dark_mode : student.dark_mode,
        special_case:
          special_case !== undefined ? special_case : student.special_case,
        special_case_comments:
          special_case_comments || student.special_case_comments,
        std_lms_status:
          std_lms_status !== undefined
            ? std_lms_status
            : student.std_lms_status,
        std_forum_status:
          std_forum_status !== undefined
            ? std_forum_status
            : student.std_forum_status,
      },
      { transaction }
    );

    // Update the user table with where clause
    const user = await User.update(
      {
        user_name: user_name,
        user_username: user_username,
        user_email: user_email,
      },
      {
        where: { user_id: student.user_id },
        transaction,
      }
    );
    // Fetch updated student with user info
    const updatedStudent = await Student.findOne({
      where: { user_id: student.user_id },
      include: [
        {
          model: User,
          as: "user",
          attributes: [
            "user_name",
            "user_username",
            "user_email",
            "user_profile_photo",
            "user_status",
            "user_type",
          ],
        },
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

    // Commit the transaction
    await transaction.commit();

    res.status(200).json({
      success: true,
      message: "Student profile updated successfully",
      data: updatedStudent,
    });
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();

    console.error("Profile update error:", error);
    res.status(500).json({
      success: false,
      message: "Server error updating profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.getStudentProfileByUserId = async (req, res) => {
  try {
    const user_id = req.params.user_id || req.query.user_id;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const student = await Student.findOne({
      where: { user_id: parseInt(user_id) },
      include: [
        {
          model: TrainingBatch,
          as: "training_batches",
          attributes: ["tb_id", "tb_name"],
        },
        {
          model: Center,
          as: "centers",
          attributes: ["center_id", "center_name"],
        },
        {
          model: Course,
          as: "courses",
          attributes: ["course_id", "course_name"],
        },
      ],
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: student,
    });
  } catch (error) {
    console.error("Error in getStudentProfileByUserId:", error);
    return res.status(500).json({
      success: false,
      message: "Error retrieving student profile",
      error: error.message,
    });
  }
};
exports.SuspendStudentByCNIC = async (req, res) => {
  const { std_cnic, suspension_reason } = req.body;
  if (!std_cnic) {
    return res.status(400).json({
      success: false,
      message: "CNIC is required",
    });
  }

  try {
    // Add transaction for data consistency
    const transaction = await sequelize.transaction();

    try {
      const [updatedRows] = await Student.update(
        {
          std_lms_status: 2,
          suspension_reason: suspension_reason || "No reason provided",
        },
        {
          where: {
            std_cnic: std_cnic,
          },
          transaction,
        }
      );

      if (updatedRows === 0) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Student not found",
        });
      }

      // Get updated student data
      const updatedStudent = await Student.findOne({
        where: {
          std_cnic: std_cnic,
        },
        transaction,
      });

      await transaction.commit();

      return res.status(200).json({
        success: true,
        message: "Student suspended successfully",
        data: updatedStudent,
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error suspending student:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while suspending student",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.UnSuspendStudentByCNIC = async (req, res) => {
  const { std_cnic } = req.body;
  if (!std_cnic) {
    return res.status(400).json({
      success: false,
      message: "CNIC is required",
    });
  }

  try {
    const transaction = await sequelize.transaction();

    try {
      const [updatedRows] = await Student.update(
        {
          std_lms_status: 1,
          suspension_reason: "",
        },
        {
          where: {
            std_cnic: std_cnic,
          },
          transaction,
        }
      );

      if (updatedRows === 0) {
        await transaction.rollback();
        return res.status(404).json({
          success: false,
          message: "Student not found",
        });
      }

      const updatedStudent = await Student.findOne({
        where: {
          std_cnic: std_cnic,
        },
        transaction,
      });

      await transaction.commit();

      return res.status(200).json({
        success: true,
        message: "Student unsuspended successfully",
        data: updatedStudent,
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error("Error unsuspending student:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while unsuspending student",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
// Send Email
exports.sendStudentMail = async (req, res) => {
  try {
    const { email, subject, message } = req.body;
    if (!email || !subject || !message) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required." });
    }
    await sendEmail(email, subject, message, `<p></p>`);
    res
      .status(200)
      .json({ success: true, message: "Email sent successfully." });
  } catch (error) {
    console.error("Error sending student email:", error);
    res.status(500).json({ success: false, message: "Failed to send email." });
  }
};
