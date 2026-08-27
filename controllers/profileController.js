const Student = require("../models/studentModel");
const Center = require("../models/center");
const Course = require("../models/course");
const TrainingBatch = require("../models/trainingBatcheModel");
const Trainer = require("../models/trainersModel");
const TrainerCenterAllocation = require("../models/trainersCenterAllocationModel");
const { sequelize } = require("../config/db");
const { allocationSqlScope } = require("../utils/trainerScope");

// Helper function to fetch student statistics
const fetchStudentStatistics = async (student, tb_id) => {
  try {
    // Use tb_id parameter as a fallback if not available in student object
    const batchId = student.tb_id || tb_id;

    if (!batchId) {
      throw new Error(
        "Training batch ID is required for fetching student statistics"
      );
    }

    // Get assignment data
    const assignments = await sequelize.query(
      `
      SELECT 
        a.as_id, 
        a.as_title, 
        a.as_deadline, 
        a.as_marks,
        a.as_added_on
      FROM 
        assignments AS a
      WHERE 
        a.tb_id = :tb_id
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

    // Get completed assignments
    const completedAssignments = await sequelize.query(
      `
      SELECT 
        a.as_id,
        a.as_title,
        s.submitted_on,
        s.obt_marks,
        a.as_marks,
        s.as_submission_status
      FROM 
        assignment_submissions AS s
      JOIN
        assignments AS a ON s.as_id = a.as_id
      WHERE 
        s.std_rollno = :std_rollno
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

    // Calculate missed assignments
    const completedAssignmentIds = completedAssignments.map((a) => a.as_id);
    const missedAssignments = assignments.filter(
      (a) =>
        !completedAssignmentIds.includes(a.as_id) &&
        new Date(a.as_deadline) < new Date()
    );

    // Calculate assignment progress
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

    // Get tickets count
    const [ticketCount] = await sequelize.query(
      `
      SELECT COUNT(*) as count
      FROM tickets
      WHERE std_rollno = :std_rollno
      `,
      {
        replacements: { std_rollno: student.std_rollno },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    // Get feedback submissions count
    const [feedbackCount] = await sequelize.query(
      `
      SELECT COUNT(*) as count
      FROM students_feedback
      WHERE std_rollno = :std_rollno
      `,
      {
        replacements: { std_rollno: student.std_rollno },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    // Get student documents
    const documents = await sequelize.query(
      `
      SELECT *
      FROM students_docs
      WHERE std_cnic = :std_cnic
      `,
      {
        replacements: { std_cnic: student.std_cnic },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    // Get professional profiles (freelancing profiles)
    const professionalProfiles = await sequelize.query(
      `
      SELECT *
      FROM students_freelancing_profiles
      WHERE std_cnic = :std_cnic
      `,
      {
        replacements: { std_cnic: student.std_cnic },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    return {
      assignments: {
        received: assignments,
        completed: completedAssignments,
        missed: missedAssignments,
        progress: assignmentProgress,
      },
      tickets: {
        count: ticketCount ? ticketCount.count : 0,
      },
      feedback: {
        submissionCount: feedbackCount ? feedbackCount.count : 0,
      },
      documents: documents,
      professionalProfiles: professionalProfiles,
    };
  } catch (error) {
    console.error("Error fetching student statistics:", error);
    throw error;
  }
};

// Get Student Profile
exports.getStudentProfile = async (tb_id, center_id, course_id, user_id, userType) => {
  let t_center_ids = [];
  let t_course_ids = [];
  let trainerAllocations = [];

  try {
    // Handle trainer-specific logic
    if (userType === "trainer") {
      const trainer = await Trainer.findOne({ where: { user_id } });

      if (!trainer) {
        return {
          success: false,
          message: "Trainer not found",
          statusCode: 404
        };
      }

      const trainerCenters = await TrainerCenterAllocation.findAll({
        where: { t_id: trainer.t_id, tb_id },
      });

      if (!trainerCenters || trainerCenters.length === 0) {
        return {
          success: false,
          message: "No centers allocated to this trainer",
          statusCode: 404
        };
      }

      t_center_ids = trainerCenters.map((center) => center.center_id);
      t_course_ids = trainerCenters.map((center) => center.course_id);
      trainerAllocations = trainerCenters;
    }

    // Pairs, not IN(centers) AND IN(courses). The latter is the cross
    // product, so a trainer teaching Digital at BUITEMS and Creative at UoB
    // also matched Digital-at-UoB - another trainer's students.
    const classSql =
      userType === "trainer" ? allocationSqlScope(trainerAllocations, "s") : null;

    const whereClause =
      userType === "trainer"
        ? `WHERE LOWER(u.user_type) = 'student'
           AND s.tb_id = ${tb_id}
           AND ${classSql || "1 = 0"}`
        : `WHERE LOWER(u.user_type) = 'student'
           AND s.tb_id = ${tb_id}`;

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
        ce.center_name
      FROM 
        user AS u
      LEFT JOIN 
        students AS s ON u.user_id = s.user_id
      LEFT JOIN 
        courses AS c ON s.course_id = c.course_id
      LEFT JOIN 
        centers AS ce ON s.center_id = ce.center_id
      ${whereClause}`;

    const [rows] = await sequelize.query(query);

    if (rows.length === 0) {
      return {
        success: false,
        message: "No students found",
        statusCode: 404
      };
    }

    // Fetch training batch details
    const trainingBatch = await TrainingBatch.findOne({ where: { tb_id } });

    // Prepare enhanced student data with additional statistics
    const enhancedStudentData = await Promise.all(
      rows.map(async (student) => {
        // Get common statistics using the helper function - pass tb_id explicitly
        const studentStats = await fetchStudentStatistics(student, tb_id);

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
        };
      })
    );

    return {
      success: true,
      data: enhancedStudentData,
      statusCode: 200
    };
  } catch (error) {
    console.error("Error fetching student profile:", error.message);
    return {
      success: false,
      message: "Server error fetching profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
      statusCode: 500
    };
  }
};

exports.getStudentProfileByCNIC = async (std_cnic) => {
  if (!std_cnic) {
    return {
      success: false,
      message: "CNIC is required",
      statusCode: 400
    };
  }

  try {
    // Fetch basic student data
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
        AND s.std_cnic = :std_cnic
      LIMIT 1
      `,
      {
        replacements: { std_cnic },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    if (!student) {
      return {
        success: false,
        message: "Student not found",
        statusCode: 404
      };
    }

    // Get student statistics using the helper function - pass tb_id explicitly from student object
    const studentStats = await fetchStudentStatistics(student, student.tb_id);

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
      ...studentStats, // Add all the statistics from the helper function
    };

    return {
      success: true,
      data: transformedData,
      statusCode: 200
    };
  } catch (error) {
    console.error("Error fetching student profile:", error);
    return {
      success: false,
      message: "Server error fetching profile",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
      statusCode: 500
    };
  }
};

// You can add API wrapper functions that accept request and response objects:
exports.getStudentProfileAPI = async (req, res) => {
  const { tb_id, center_id, course_id, user_id, userType } = req.query;
  const result = await exports.getStudentProfile(tb_id, center_id, course_id, user_id, userType);
  return res.status(result.statusCode).json({
    success: result.success,
    message: result.message,
    data: result.data,
    error: result.error
  });
};

exports.getStudentProfileByCNICAPI = async (req, res) => {
  const { std_cnic } = req.params;
  const result = await exports.getStudentProfileByCNIC(std_cnic);
  return res.status(result.statusCode).json({
    success: result.success,
    message: result.message,
    data: result.data,
    error: result.error
  });
};

module.exports = exports;
