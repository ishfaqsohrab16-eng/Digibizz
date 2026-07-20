const student = require("../models/studentModel");
const Assignment = require("../models/assignmentModel");
const assignmentSubmission = require("../models/assignmentSubmissionModel");
const Quiz = require("../models/StudentQuiz");
const QuizAttempts = require("../models/StudentQuizAttempts");
const { Op, where } = require("sequelize");
const Earnings = require("../models/earningsModel");
const Course = require("../models/course");
const Center = require("../models/center");
const Attendance = require("../models/attendanceModel");
const CenterDates = require("../models/centersDatesModel");
const TrainerCenterAllocation = require("../models/trainersCenterAllocationModel");
const User = require("../models/userModel");
const TrainerModel = require("../models/trainersModel");
const StudentLeaves = require("../models/studentLeaveModel");
const ClassAnnouncements = require("../models/classAnnouncementsModel");
const Ticket = require("../models/ticketModel");
const LectureRecordings = require("../models/lectureRecordingModel");
const LearningResoruces = require("../models/learningResourceModel");
const StudentDocuments = require("../models/studentsDocsModel");
const WeaklyFeedback = require("../models/studentsFeedbackModel");
const TrainingBatchModel = require("../models/trainingBatcheModel");
const MasterTrainer = require("../models/masterTrainersModel");
const DailyReport = require("../models/dailyLectureReport");
const Holiday = require("../models/holidaysModel");
const ExamAssignment = require("../models/examAssessmentModel");
const CenterUsers = require("../models/centerUsersModel");
const profileController = require("./profileController");
const { getAppSettings } = require("../utils/appSettings");

exports.getStudentDashoard = async (req, res) => {
  try {
    const { user_id, tb_id, userType } = req.params;
    let course_id, center_id;
    let filterConditions = {};
    let whereClause = { tb_id };

    // Get student profile information
    const studentProfile = await student.findOne({
      where: {
        user_id: user_id,
      },
    });

    if (!studentProfile) {
      return res.status(404).json({ message: "Student not found" });
    }
    course_id = studentProfile.course_id;
    center_id = studentProfile.center_id;
    whereClause = {
      ...whereClause,
      course_id: studentProfile.course_id,
      center_id: studentProfile.center_id,
    };
    const studentDocuments = await StudentDocuments.findAll({
      where:
        userType === "student"
          ? { std_cnic: studentProfile.std_cnic, tb_id: tb_id }
          : { tb_id: tb_id },
      order: [["doc_date", "DESC"]],
    });

    // Define required document types
    const requiredDocTypes = [
      'passport_photo',
      'cnic_front',
      'cnic_back',
      'domicile',
      'degree'
    ];

    // Check which documents are uploaded and approved
    const uploadedDocTypes = studentDocuments
      .filter(doc => doc.doc_status === 0 || doc.doc_status === 1) // Only approved documents
      .map(doc => doc.doc_type);

    // Find missing documents
    const missingDocuments = requiredDocTypes.filter(docType => 
      !uploadedDocTypes.includes(docType)
    );

    const hasAllApprovedDocs = missingDocuments.length === 0;

    const appSettings = getAppSettings();
    const requireStudentDocuments =
      appSettings.requireStudentDocuments !== false;

    // If documents are missing and user is a student, return early with document upload requirement
    if (userType === "student" && requireStudentDocuments && !hasAllApprovedDocs) {
      return res.status(200).json({
        success: false,
        documents_uploaded: false,
        message: "Please upload all required documents to access the dashboard",
        missing_documents: missingDocuments,
        required_documents: requiredDocTypes,
        uploaded_documents: uploadedDocTypes,
        redirect_to: "StudentDocs"
      });
    }

    let givCertificate = true;
    const examAssessmentModel = await ExamAssignment.findOne({
      where: {
        tb_id: studentProfile.tb_id,
        std_cnic: studentProfile.std_cnic,
        ea_type: "FINAL",
      },
    });

    if (examAssessmentModel) {
      if (examAssessmentModel.total_score >= 60 && hasAllApprovedDocs) {
        givCertificate = true;
      } else {
        givCertificate = false;
      }
    } else {
      givCertificate = false;
    }
    // Get assignments with deadlines not passed
    const pendingAssignments = await Assignment.findAll({
      where: {
        ...whereClause,
      },
      attributes: ["as_title", "as_marks", "as_deadline", "as_id"],
      raw: true,
    });

    // Format assignments
    const recentAssignments = pendingAssignments.map((assignment) => ({
      title: assignment.as_title,
      points: assignment.as_marks,
      deadline: assignment.as_deadline,
    }));
    const course = await Course.findOne({
      where: {
        course_id: course_id,
      },
    });
    const center = await Center.findOne({
      where: {
        center_id: center_id,
      },
    });

    // Find assignments that the student hasn't submitted yet
    const notsubmittedAssignments = await Promise.all(
      pendingAssignments.map(async (assignment) => {
        const submission = await assignmentSubmission.findOne({
          where: {
            std_rollno: studentProfile.std_rollno,
            tb_id: tb_id,
            as_id: assignment.as_id,
          },
        });

        // If no submission found or submission status is 2 (rejected/needs resubmission)
        if (!submission) {
          return {
            title: assignment.as_title,
            points: assignment.as_marks,
            deadline: assignment.as_deadline,
            submitted: false,
            assignmentId: assignment.as_id,
          };
        }
        return null;
      })
    ).then((results) => results.filter((item) => item !== null));

    // Count submitted and not submitted assignments
    const notSubmittedCount = notsubmittedAssignments.length;
    const submittedCount = await assignmentSubmission.count({
      where: {
        std_rollno: studentProfile.std_rollno,
        tb_id: tb_id,
        as_submission_status: {
          [Op.ne]: 2, // Not equal to status 2 (rejected/needs resubmission)
        },
      },
    });

    // Get center dates for attendance calculation
    const centerDates = await CenterDates.findOne({
      where: {
        center_id: center_id,
        tb_id: tb_id,
      },
      attributes: ["tb_start", "tb_end"],
      raw: true,
    });

    // Calculate attendance progress (OPTIMIZED - matches studentController logic)
    let attendanceProgress = 0;
    
    try {
      // Normalize date function for consistent comparison
      const normalizeDate = (date) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
      };

      // Determine start date: use student's admission date if available, otherwise use center start date
      let startDate = null;
      if (studentProfile.std_added_on) {
        startDate = normalizeDate(new Date(studentProfile.std_added_on));
      } else if (centerDates?.tb_start) {
        startDate = normalizeDate(new Date(centerDates.tb_start));
      }

      // Determine end date: use center end date
      let endDate = null;
      if (centerDates?.tb_end) {
        endDate = normalizeDate(new Date(centerDates.tb_end));
      }

      if (startDate && endDate) {
        const currentDate = normalizeDate(new Date());

        // Fetch attendance records
        const attendanceRecords = await Attendance.findAll({
          where: {
            std_cnic: studentProfile.std_cnic,
            tb_id: tb_id,
            center_id: center_id,
            course_id: course_id,
          },
          attributes: ["attend_status", "attend_date"],
          raw: true,
        });

        // Create a map of attendance records by date for quick lookup
        const attendanceMap = new Map();
        attendanceRecords.forEach((record) => {
          const dateStr = normalizeDate(new Date(record.attend_date)).toISOString().split("T")[0];
          attendanceMap.set(dateStr, record.attend_status.toUpperCase());
        });

        // Fetch holidays (include both global holidays and center-specific holidays)
        const holidays = await Holiday.findAll({
          where: { 
            tb_id: tb_id,
            [Op.or]: [
              { center_id: null },           // Global holidays
              { center_id: center_id }       // Center-specific holidays
            ]
          },
          attributes: ["h_date", "center_id"],
          raw: true,
        });
        
        // Create a set of holiday dates for quick lookup
        const holidayDates = new Set(
          holidays.map(h => normalizeDate(new Date(h.h_date)).toISOString().split("T")[0])
        );

        // Determine the effective end date (today or batch end date, whichever is earlier)
        const effectiveEndDate = currentDate < endDate ? currentDate : endDate;

        let totalWorkingDays = 0;
        let presentDays = 0;

        // Iterate through each day in the date range
        for (
          let date = new Date(startDate);
          date <= effectiveEndDate;
          date.setDate(date.getDate() + 1)
        ) {
          const dayOfWeek = date.getDay();
          const dateStr = date.toISOString().split("T")[0];
          
          // Skip weekends (Saturday = 6, Sunday = 0)
          if (dayOfWeek === 0 || dayOfWeek === 6) {
            continue;
          }

          // This is a working day (weekday)
          totalWorkingDays++;

          // Check if this date is a holiday
          const isHoliday = holidayDates.has(dateStr);

          // Get attendance status for this date
          const attendStatus = attendanceMap.get(dateStr);

          // Count as present if:
          // 1. It's a holiday (automatically marked as present)
          // 2. Attendance status is 'P' (Present)
          // 3. Attendance status is 'L' (Leave - counted as present)
          if (isHoliday || attendStatus === 'P' || attendStatus === 'L') {
            presentDays++;
          }
          // If attendStatus is 'A' (Absent) or undefined (no record), it's not counted as present
        }

        // Calculate attendance percentage
        attendanceProgress = Math.min(
          totalWorkingDays > 0
            ? Math.round((presentDays / totalWorkingDays) * 100)
            : 0,
          100
        );
      }
    } catch (attendanceError) {
      console.error("Error calculating attendance:", attendanceError);
      attendanceProgress = 0;
    }

    // Calculate overall progress based on assignments and quizzes
    const totalAssignments = await Assignment.count({
      where: {
        tb_id: tb_id,
        course_id: course_id,
        center_id: center_id,
      },
    });

    const completedAssignments = await assignmentSubmission.count({
      where: {
        std_rollno: studentProfile.std_rollno,
        tb_id: tb_id,
      },
    });
    const trainerCenterAllocation = await TrainerCenterAllocation.findOne({
      where: {
        tb_id: tb_id,
        center_id: studentProfile.center_id,
        course_id: studentProfile.course_id,
      },
    });
    const totalQuizzes = trainerCenterAllocation
      ? await Quiz.count({
          where: {
            tb_id: tb_id,
            t_id: trainerCenterAllocation.t_id,
          },
        })
      : 0;

    const completedQuizzes = await QuizAttempts.count({
      where: {
        std_cnic: studentProfile.std_cnic,
        tb_id: tb_id,
      },
    });

    // Calculate overall progress percentage
    const totalItems = totalAssignments + totalQuizzes;
    const completedItems = completedAssignments + completedQuizzes;
    const overallProgress =
      totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
    const u = await User.findOne({
      where: {
        user_id: user_id,
      },
    });

    const lmsStatus =
      studentProfile.std_lms_status === 1
        ? "Active"
        : studentProfile.std_lms_status === 2
        ? "Suspended"
        : "Not Join LMS";
    const statistics = [
      { label: "Roll No.", value: studentProfile.std_rollno },
      { label: "Name.", value: u.user_name },
      { label: "Domain", value: course?.course_full_name || "Not assigned" },
      { label: "Center", value: center?.center_name || "Not assigned" },
      // { label: "Overall Progress", value: `${overallProgress.toFixed(1)}%` },
      {
        label: "Attendance Progress",
        value: `${attendanceProgress.toFixed(1)}%`,
      },
    ];

    // Get quiz attempts and performance - apply role-based filtering
    const quizAttempts = await QuizAttempts.findAll({
      where:
        userType === "student"
          ? { std_cnic: studentProfile.std_cnic, tb_id: tb_id }
          : { tb_id: tb_id },
      include: [
        {
          model: Quiz,
          as: "student_quiz",
          attributes: ["quiz_title"],
        },
      ],
      order: [["attempt_id", "ASC"]],
    });

    // Format quiz performance data
    const quizPerformanceData = quizAttempts.map((attempt, index) => ({
      name: `Quiz ${index + 1}`,
      value: parseInt(attempt.marks_obt),
    }));

    // Get assignment submissions and performance - apply role-based filtering
    const assignmentSubmissions = await assignmentSubmission.findAll({
      where:
        userType === "student"
          ? { std_rollno: studentProfile.std_rollno, tb_id: tb_id }
          : { tb_id: tb_id },
    });

    // Format assignment performance data
    const assignmentPerformanceData = assignmentSubmissions.map(
      (submission, index) => ({
        name: `Assignment ${index + 1}`,
        value: parseInt(submission.obt_marks) || 0,
      })
    );

    // Count pending items
    const pendingQuizCount = trainerCenterAllocation
      ? Math.max(
          (await Quiz.count({
            where: {
              tb_id: tb_id,
              t_id: trainerCenterAllocation.t_id,
            },
          })) -
            (await QuizAttempts.count({
              where: {
                std_cnic: studentProfile.std_cnic,
                tb_id: tb_id,
              },
            })),
          0
        )
      : 0;

    const pendingAssignmentCount = pendingAssignments.length;

    let earnings = 0;
    const batchEarnings = await Earnings.sum("earning_amount", {
      where: {
        std_id: studentProfile.std_id,
        tb_id: tb_id,
      },
    });
    earnings = parseFloat(batchEarnings || 0).toFixed(2);

    // Get latest announcement with role-based filtering
    const latestAnnouncement = await ClassAnnouncements.findOne({
      where:
        userType === "student"
          ? { center_id: center_id, course_id: course_id, tb_id: tb_id }
          : { ...whereClause },
      order: [["ca_added_on", "DESC"]],
    });

    const studentProfilebyCNIC =
      await profileController.getStudentProfileByCNIC(studentProfile.std_cnic);

    // Apply role-based filtering to all data queries
    const classAnnouncement = await ClassAnnouncements.findAll({
      where: { ...whereClause },
      order: [["ca_added_on", "DESC"]],
    });

    const quiz =
      userType === "student" && !trainerCenterAllocation
        ? []
        : await Quiz.findAll({
            where: {
              tb_id,
              ...(userType === "student"
                ? { t_id: trainerCenterAllocation.t_id }
                : {}),
            },
            order: [["quiz_created_on", "DESC"]],
          });

    const assignmentList = await Assignment.findAll({
      where: { ...whereClause },
      order: [["as_added_on", "DESC"]],
    });

    const earningsData = await Earnings.findAll({
      where:
        userType === "student"
          ? { std_id: studentProfile.std_id, tb_id: tb_id }
          : { tb_id: tb_id },
      order: [["earning_date", "DESC"]],
    });

    const tickets = await Ticket.findAll({
      where:
        userType === "student"
          ? { std_rollno: studentProfile.std_rollno, tb_id: tb_id }
          : { tb_id: tb_id },
      order: [["ticket_date", "DESC"]],
    });

    const reacordedLeactures = await LectureRecordings.findAll({
      where: { ...whereClause },
      order: [["lr_added_on", "DESC"]],
    });

    const learningResources = await LearningResoruces.findAll({
      where: { ...whereClause },
      order: [["ls_added_on", "DESC"]],
    });

   

    const feedback = await WeaklyFeedback.findAll({
      where:
        userType === "student"
          ? { std_rollno: studentProfile.std_rollno, tb_id: tb_id }
          : { tb_id: tb_id },
      order: [["sf_date", "DESC"]],
    });

    const trainingBatches = await TrainingBatchModel.findAll({
      where: { tb_id: studentProfile.tb_id },
    });
    const centerData = await Center.findAll({
      where: { center_id: studentProfile.center_id },
    });
    const courseData = await Course.findAll({
      where: { course_id: studentProfile.course_id },
    });
    

    // Return tailored data based on user role
    res.status(200).json({
      success: true,
      documents_uploaded: hasAllApprovedDocs,
      userRole: userType,
      statistics,
      recentAssignments,
      quizPerformanceData,
      assignmentPerformanceData,
      givCertificate,
      studentProfilebyCNIC:
        userType === "student" ? studentProfilebyCNIC : undefined,
      classAnnouncement,
      quiz,
      assignmentList,
      earningsData,
      tickets,
      reacordedLeactures,
      learningResources,
      studentDocuments: userType === "student" ? studentDocuments : undefined,
      feedback: userType === "student" ? feedback : undefined,
      trainingBatches,
      centerData,
      courseData,
      documentStatus: userType === "student" ? {
        hasAllDocuments: hasAllApprovedDocs,
        missingDocuments: missingDocuments,
        requiredDocuments: requiredDocTypes,
        uploadedDocuments: uploadedDocTypes
      } : undefined,
      dashboardStats: {
        earnings,
        pendingAssignments: pendingAssignmentCount,
        pendingQuizzes: pendingQuizCount,
        overallProgress: parseFloat(overallProgress.toFixed(1)),
        attendanceProgress: parseFloat(attendanceProgress.toFixed(1)),
        submittedAssignments: submittedCount,
        notSubmittedAssignments: notSubmittedCount,
        totalAssignments: pendingAssignments.length,
      },
      latestAnnouncement,
      notsubmittedAssignments, // Included to show which assignments haven't been submitted
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getTrainerDashoard = async (req, res) => {
  try {
    const { user_id, tb_id } = req.params;

    const trainer = await TrainerModel.findOne({
      where: { user_id: user_id },
    });

    if (!trainer) {
      return res.status(404).json({ message: "Trainer not found" });
    }

    // Use findAll to get ALL classes/centers assigned to this trainer
    const allocations = await TrainerCenterAllocation.findAll({
      where: { t_id: trainer.t_id, tb_id: tb_id },
    });

    if (!allocations || allocations.length === 0) {
      return res.status(403).json({ message: "Trainer not assigned to this batch" });
    }

    // Extract arrays of all allowed centers and courses for this trainer
    const allowedCenters = allocations.map((a) => a.center_id);
    const allowedCourses = allocations.map((a) => a.course_id);

    const pendingLeaves = await StudentLeaves.count({
      where: {
        course_id: { [Op.in]: allowedCourses },
        center_id: { [Op.in]: allowedCenters },
        tb_id: tb_id,
        sl_status: 0,
      },
    });

    // Use the first center to determine calendar dates
    const centerDates = await CenterDates.findOne({
      where: {
        center_id: allowedCenters[0],
        tb_id: tb_id,
      },
    });

    if (!centerDates) {
      return res.status(404).json({ message: "Center dates not found" });
    }

    // Fixed timezone-aware date handling
    const startDateString = new Date(centerDates.tb_start).toLocaleDateString(
      "en-CA",
      { timeZone: "Asia/Karachi" }
    );
    const currentDateString = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Karachi",
    });
    const endDateString = new Date(centerDates.tb_end).toLocaleDateString(
      "en-CA",
      { timeZone: "Asia/Karachi" }
    );

    const workingDays = [];

    // Parse dates to avoid timezone issues
    const [startYear, startMonth, startDay] = startDateString
      .split("-")
      .map(Number);
    const [endYear, endMonth, endDay] = currentDateString
      .split("-")
      .map(Number);

    let current = new Date(startYear, startMonth - 1, startDay); // Month is 0-indexed
    const end = new Date(endYear, endMonth - 1, endDay);

    while (current <= end) {
      const dayOfWeek = current.getDay();

      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, "0");
        const day = String(current.getDate()).padStart(2, "0");
        workingDays.push(`${year}-${month}-${day}`);
      }

      current.setDate(current.getDate() + 1);
    }

    const holidays = await Holiday.findAll({
      where: {
        tb_id,
        h_date: { [Op.between]: [startDateString, currentDateString] },
      },
      attributes: ["h_date"],
      raw: true,
    });

    const holidaySet = new Set(
      holidays.map((h) => {
        if (typeof h.h_date === "string" && h.h_date.includes("T")) {
          return h.h_date.split("T")[0];
        }
        const date = new Date(h.h_date);
        return date.toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
      })
    );

    const attendanceRecords = await Attendance.findAll({
      where: {
        tb_id,
        course_id: { [Op.in]: allowedCourses },
        center_id: { [Op.in]: allowedCenters },
        attend_date: { [Op.between]: [startDateString, currentDateString] },
      },
      attributes: ["attend_date"],
      raw: true,
    });

    const attendedSet = new Set(
      attendanceRecords.map((a) => {
        if (typeof a.attend_date === "string" && a.attend_date.includes("T")) {
          return a.attend_date.split("T")[0];
        }
        const date = new Date(a.attend_date);
        return date.toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
      })
    );

    const missingAttendanceDates = workingDays.filter((date) => {
      if (currentDateString < endDateString) {
        return !holidaySet.has(date) && !attendedSet.has(date);
      } else {
        return (
          !holidaySet.has(date) &&
          !attendedSet.has(date) &&
          date <= endDateString
        );
      }
    });
    
    let isAttendance = false;
    const todayFormatted = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Karachi",
    });

    const attendance = await Attendance.findOne({
      where: {
        tb_id,
        course_id: { [Op.in]: allowedCourses },
        center_id: { [Op.in]: allowedCenters },
        attend_date: todayFormatted,
      },
    });
    isAttendance = !!attendance;

    let isDailyReportSubmitted = false;
    const dailyReport = await DailyReport.findOne({
      where: {
        tb_id,
        course_id: { [Op.in]: allowedCourses },
        center_id: { [Op.in]: allowedCenters },
        t_id: trainer.t_id,
        dlr_date: todayFormatted,
      },
    });
    isDailyReportSubmitted = !!dailyReport;

    const missingAttendanceStats = {
      count: missingAttendanceDates.length,
      dates: missingAttendanceDates,
      lastUpdated: new Date(),
    };

    const recentAssignments = await Assignment.findAll({
      where: {
        tb_id,
        course_id: { [Op.in]: allowedCourses },
        center_id: { [Op.in]: allowedCenters },
      },
      limit: 5,
      order: [["as_added_on", "DESC"]],
    });

    const activeStudents = await student.count({
      where: {
        tb_id,
        course_id: { [Op.in]: allowedCourses },
        center_id: { [Op.in]: allowedCenters },
        std_lms_status: 1,
      },
    });

    const totalStudents = await student.count({
      where: {
        tb_id,
        course_id: { [Op.in]: allowedCourses },
        center_id: { [Op.in]: allowedCenters },
      },
    });
    
    const batchEarnings = await Earnings.sum("earning_amount", {
      where: {
        tb_id,
        course_id: { [Op.in]: allowedCourses },
        center_id: { [Op.in]: allowedCenters },
        earning_status: 1,
      },
    });

    const totalEarnings = parseFloat(batchEarnings || 0).toFixed(2);

    // Success Stories Count
    const successStories = await Earnings.count({
      where: {
        tb_id,
        course_id: { [Op.in]: allowedCourses },
        center_id: { [Op.in]: allowedCenters },
        earning_status: 1,
      },
    });

    // Unanswered Tickets
    const unansweredTickets = await Ticket.count({
      where: {
        tb_id,
        ticket_status: "open",
        t_id: trainer.t_id, // Unanswered tickets rely on the trainer id directly
      },
    });

    res.status(200).json({
      statistics: {
        pendingLeaves: {
          count: pendingLeaves,
          lastUpdated: new Date(),
        },
        missingAttendance: missingAttendanceStats,
        recentAssignments: recentAssignments,
        students: {
          active: activeStudents,
          total: totalStudents,
        },
        batchEarnings: totalEarnings,
        successStories: {
          count: successStories,
          lastUpdated: new Date(),
        },
        unansweredTickets: {
          count: unansweredTickets,
          lastUpdated: new Date(),
        },
        isDailyReportSubmitted,
        isAttendance,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getMasterTrainerDashoard = async (req, res) => {
  try {
    const { user_id, tb_id } = req.params;

    const masterTrainerAssignments = await MasterTrainer.findAll({
      where: { user_id: user_id },
      attributes: ["mt_course_id"],
    });

    if (!masterTrainerAssignments || masterTrainerAssignments.length === 0) {
      return res.status(404).json({ message: "Master Trainer not found" });
    }

    const masterTrainerCourseIds = [
      ...new Set(
        masterTrainerAssignments
          .map((assignment) => Number(assignment.mt_course_id))
          .filter(Boolean)
      ),
    ];

    if (masterTrainerCourseIds.length === 0) {
      return res
        .status(404)
        .json({ message: "No courses assigned to this Master Trainer" });
    }

    const trainerCenters = await TrainerCenterAllocation.findAll({
      where: {
        course_id: { [Op.in]: masterTrainerCourseIds },
        tb_id: tb_id,
      },
      include: [
        {
          model: TrainerModel,
          as: "trainer",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["user_name"], // Include trainer name
            },
          ],
        },
        {
          model: Center,
          as: "center",
          attributes: ["center_name"], // Include center name
        },
        {
          model: Course,
          as: "course",
          attributes: ["course_name"],
        },
      ],
    });

    const totalCenters = trainerCenters.length;
    const uniqueTrainerIds = new Set(
      trainerCenters.map((allocation) => allocation.t_id)
    );
    const totalTrainers = uniqueTrainerIds.size; // Count unique trainers
    
    // Get all specific center IDs supervised by this Master Trainer
    const allowedCenters = trainerCenters.map((allocation) => allocation.center_id);

    const totalStudents = await student.count({
      where: { 
        course_id: { [Op.in]: masterTrainerCourseIds },
        center_id: { [Op.in]: allowedCenters },
        tb_id: tb_id 
      },
    });
    
    const totalTickets = await Ticket.count({
      where: { 
        tb_id, 
        course_id: { [Op.in]: masterTrainerCourseIds },
        center_id: { [Op.in]: allowedCenters }
      },
    });

    const totalAssignments = await Assignment.count({
      where: { 
        tb_id, 
        course_id: { [Op.in]: masterTrainerCourseIds },
        center_id: { [Op.in]: allowedCenters }
      },
    });

    // Get all t_ids from trainerCenters
    const trainerIds = trainerCenters.map((allocation) => allocation.t_id);

    const totalQuizzes = await Quiz.count({
      where: {
        tb_id,
        t_id: { [Op.in]: trainerIds }, // Use t_id from trainerCenters
      },
    });

    const totalEarnings = await Earnings.sum("earning_amount", {
      where: {
        tb_id,
        course_id: { [Op.in]: masterTrainerCourseIds },
        center_id: { [Op.in]: allowedCenters },
        earning_status: 1,
      },
    });

    const trainerCenterData = await Promise.all(
      trainerCenters.map(async (allocation) => {
        const trainerEarnings = await Earnings.sum("earning_amount", {
          where: {
            tb_id,
            t_id: allocation.t_id,
            center_id: allocation.center_id,
            course_id: allocation.course_id,
            earning_status: 1,
          },
        });

        // Calculate working days for this trainer's center and batch
        const centerDates = await CenterDates.findOne({
          where: { tb_id, center_id: allocation.center_id },
        });

        let workingDays = [];
        let holidaySet = new Set();
        let totalDays = 0;
        let submittedDays = 0;
        let reportPercentage = "0.00";
        let holidayDates = [];

        if (centerDates) {
          const startDate = new Date(centerDates.tb_start)
            .toISOString()
            .split("T")[0];
          const today = new Date();
          const tbEndDate = new Date(centerDates.tb_end);
          let endDateObj = tbEndDate;
          if (today < tbEndDate) {
            endDateObj = today;
          }
          const endDate = endDateObj.toISOString().split("T")[0];

          // Build working days (Mon-Fri)
          let iterDate = new Date(startDate);
          const lastDate = new Date(endDate);
          while (iterDate <= lastDate) {
            const dayOfWeek = iterDate.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
              workingDays.push(iterDate.toISOString().split("T")[0]);
            }
            iterDate.setDate(iterDate.getDate() + 1);
          }

          // Get holidays for this center/batch
          const holidays = await Holiday.findAll({
            where: {
              tb_id,
              h_date: { [Op.between]: [startDate, endDate] },
            },
            attributes: ["h_date"],
            raw: true,
          });
          holidaySet = new Set(holidays.map((h) => h.h_date));
          holidayDates = Array.from(holidaySet);

          // Get submitted report dates for this trainer
          const dailyLectureReport = await DailyReport.findAll({
            where: {
              tb_id,
              t_id: allocation.t_id,
              center_id: allocation.center_id,
              course_id: allocation.course_id,
            },
            attributes: ["dlr_date"],
            raw: true,
          });
          const reportDateSet = new Set(
            dailyLectureReport.map((r) => r.dlr_date)
          );
          const submittedReportDates = workingDays.filter((date) =>
            reportDateSet.has(date)
          );

          totalDays = workingDays.filter(
            (date) => !holidaySet.has(date)
          ).length;
          submittedDays = submittedReportDates.length;
          reportPercentage =
            totalDays > 0
              ? ((submittedDays / totalDays) * 100).toFixed(2)
              : "0.00";
        }

        return {
          trainer_user_id: allocation.trainer.user_id,
          trainerName: allocation.trainer?.user.user_name,
          centerName: allocation.center?.center_name,
          courseName: allocation.course?.course_name,
          earnings: parseFloat(trainerEarnings || 0).toFixed(2),
          totalDays,
          submittedDays,
          reportPercentage: Number(reportPercentage),
          holidayDates,
        };
      })
    );

    res.status(200).json({
      statistics: {
        totalCenters,
        totalTrainers, // Updated to reflect unique trainers
        totalStudents,
        totalTickets,
        totalAssignments,
        totalQuizzes,
        totalEarnings: parseFloat(totalEarnings || 0).toFixed(2),
        trainerCenterData, // Include earnings by trainer
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};


exports.getCenterUserDashboard = async (req, res) => {
  const { user_id, tb_id } = req.params;
  try {
    console.log("Center User Dashboard", user_id, tb_id);
    const centerUser = await CenterUsers.findOne({
      where: { user_id: user_id },
    });
    const students = await student.findAll({
      where: {
        tb_id: tb_id,
        center_id: centerUser.center_id,
      },
      include: [
        { model: Center, as: "centers", attributes: ["center_name"] },
        { model: Course, as: "courses", attributes: ["course_name"] },
        {
          model: TrainingBatchModel,
          as: "training_batches",
          attributes: ["tb_name"],
        },
      ],
    });

    const earnings = await Earnings.findAll({
      where: {
        tb_id: tb_id,
        center_id: centerUser.center_id,
      },
    });

    const stats = {
      enrolled: students.length,
      active: students.filter(
        (student) =>
          student.std_lms_status === 1 && student.suspension_reason == ""
      ).length,
      inactive: students.filter(
        (student) => student.std_rollno === "" && student.std_lms_status === 0
      ).length,
      suspended: students.filter((student) => student.std_lms_status === 2)
        .length,
      stories: (() => {
        // Filter logs with act_type === "story" and earning_status === 1, then count unique std_id
        const filtered = earnings.filter(
          (log) => log.earning_status === 1 && log.std_id
        );
        const uniqueStdIds = new Set(filtered.map((log) => log.std_id));
        return uniqueStdIds.size;
      })(),
      batchEarning: earnings
        .filter((earn) => earn.earning_status === 1)
        .reduce((sum, earn) => sum + (parseFloat(earn.earning_amount) || 0), 0),
    };

    res.json({
      statistics: stats,
    });
  } catch (error) {
    console.error("Fetch activity logs error:", error);
    res.status(500).json({ message: "Server error fetching activity logs" });
  }
};
