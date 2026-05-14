const Attendance = require("../models/attendanceModel");
const { validationResult } = require("express-validator");
const Student = require("../models/studentModel");
const Center = require("../models/center");
const Course = require("../models/course");
const TrainingBatch = require("../models/trainingBatcheModel");
const Trainer = require("../models/trainersModel");
const TrainerCenterAllocation = require("../models/trainersCenterAllocationModel");
const User = require("../models/userModel");
const CenterDates = require("../models/centersDatesModel");
const { Op } = require("sequelize");
const { startOfMonth, endOfMonth } = require("date-fns");
const { Sequelize } = require("sequelize");
const sequelize = require("../config/db");


// Create Attendance Record
exports.createAttendance = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const attendanceRecords = req.body;

    // Validate input
    if (!Array.isArray(attendanceRecords) || attendanceRecords.length === 0) {
      return res
        .status(400)
        .json({ message: "Invalid attendance records format" });
    }

    // Get user_id from first record since it will be same for all records
    const { user_id, tb_id } = attendanceRecords[0];

    if (!user_id) {
      return res.status(400).json({ message: "User ID is required" });
    }

    if (!tb_id) {
      return res.status(400).json({ message: "Batch ID is required" });
    }

    // Find trainer
    const trainer = await Trainer.findOne({
      where: { user_id: user_id },
    });

    if (!trainer) {
      return res.status(404).json({ message: "Trainer not found" });
    }

    // Find trainer center allocations
    const trainerCenterAllocations = await TrainerCenterAllocation.findAll({
      where: {
        t_id: trainer.t_id,
        tb_id: tb_id,
      },
      raw: true,
    });

    if (!trainerCenterAllocations || trainerCenterAllocations.length === 0) {
      return res
        .status(404)
        .json({ message: "Trainer not assigned to this batch" });
    }

    // Create a map of trainer's allocated center-course combinations for quick lookup
    const trainerCenterCourseMap = new Map();
    trainerCenterAllocations.forEach((allocation) => {
      const key = `${allocation.center_id}_${allocation.course_id}`;
      trainerCenterCourseMap.set(key, allocation);
    });

    // Get all student CNICs from the attendance records
    const studentCNICs = attendanceRecords.map((record) => record.std_cnic);

    // Fetch students with their actual center_id and course_id
    const students = await Student.findAll({
      where: {
        std_cnic: {
          [Op.in]: studentCNICs,
        },
        tb_id: tb_id,
      },
      attributes: ["std_cnic", "center_id", "course_id"],
      raw: true,
    });

    if (!students || students.length === 0) {
      return res.status(404).json({ message: "No students found for this batch" });
    }

    // Create a map of student CNIC to their center and course
    const studentCenterMap = new Map();
    students.forEach((student) => {
      studentCenterMap.set(student.std_cnic, {
        center_id: student.center_id,
        course_id: student.course_id,
      });
    });

    // Prepare attendance records with correct center_id for each student
    const recordsToCreate = [];
    const unauthorizedStudents = [];

    attendanceRecords.forEach((record) => {
      const studentInfo = studentCenterMap.get(record.std_cnic);
      
      if (!studentInfo) {
        // Student not found in the database
        return;
      }

      const centerCourseKey = `${studentInfo.center_id}_${studentInfo.course_id}`;
      
      // Check if trainer is allocated to this student's center-course combination
      if (trainerCenterCourseMap.has(centerCourseKey)) {
        recordsToCreate.push({
          std_cnic: record.std_cnic,
          attend_status: record.attend_status,
          attend_date: record.attend_date,
          center_id: studentInfo.center_id, // Use student's actual center_id
          course_id: studentInfo.course_id, // Use student's actual course_id
          tb_id: tb_id,
        });
      } else {
        // Trainer not authorized for this student's center
        unauthorizedStudents.push(record.std_cnic);
      }
    });

    if (recordsToCreate.length === 0) {
      return res.status(403).json({
        message: "Trainer is not authorized to mark attendance for any of these students",
        unauthorizedStudents: unauthorizedStudents,
      });
    }

    // Create attendance records
    const newAttendances = await Attendance.bulkCreate(recordsToCreate, {
      ignoreDuplicates: true, // Prevent duplicates
    });

    res.status(201).json({
      message: "Attendance records created successfully",
      attendance: newAttendances,
      totalRecords: recordsToCreate.length,
      successfulRecords: newAttendances.length,
      unauthorizedStudents: unauthorizedStudents.length > 0 ? unauthorizedStudents : undefined,
    });
  } catch (error) {
    console.error("Attendance creation error:", error);
    res
      .status(500)
      .json({ message: "Server error during attendance creation" });
  }
};
// Bulk Create Attendance Records
exports.bulkCreateAttendance = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const attendanceRecords = req.body;

    // Validate that all records have required fields
    const missingFields = attendanceRecords.some(
      (record) =>
        !record.std_cnic ||
        !record.center_id ||
        !record.course_id ||
        !record.tb_id ||
        !record.attend_date
    );

    if (missingFields) {
      return res.status(400).json({
        message: "All records must include std_cnic, center_id, course_id, tb_id, and attend_date",
      });
    }

    const createdRecords = await Attendance.bulkCreate(attendanceRecords, {
      ignoreDuplicates: true, // Skip duplicates instead of throwing error
    });

    res.status(201).json({
      message: "Bulk attendance records created successfully",
      attendance: createdRecords,
      totalRecords: attendanceRecords.length,
      successfulRecords: createdRecords.length,
      skippedRecords: attendanceRecords.length - createdRecords.length,
    });
  } catch (error) {
    console.error("Bulk attendance creation error:", error);
    res
      .status(500)
      .json({ message: "Server error during bulk attendance creation" });
  }
};
exports.getAttendanceHistory = async (req, res) => {
  try {
    const { month, batchId, centerId, courseId, user_id } = req.query;

    // Validate required parameters (removed strict centerId/courseId checks to allow '0' or 'All')
    if (!month || !batchId) {
      return res
        .status(400)
        .json({ message: "Missing required query parameters: month and batchId" });
    }

    // 1. Setup dynamic WHERE clauses
    const studentWhere = {
      tb_id: batchId,
      std_lms_status: {
        [Op.ne]: 2,
      },
    };
    const attendanceWhere = {
      tb_id: batchId,
    };

    let targetCenterId = centerId;

    // 2. Check User Role and enforce Trainer Allocations
    if (user_id) {
      const user = await User.findByPk(user_id);

      if (user && user.user_type === "trainer") {
        const trainer = await Trainer.findOne({ where: { user_id } });
        
        if (!trainer) {
          return res.status(404).json({ message: "Trainer not found" });
        }

        // Find all center/course combinations this trainer is allowed to see
        const allocations = await TrainerCenterAllocation.findAll({
          where: { t_id: trainer.t_id, tb_id: batchId },
        });

        if (allocations.length === 0) {
          return res.status(403).json({ message: "Trainer not assigned to this batch" });
        }

        const allowedCenters = allocations.map((a) => a.center_id);
        const allowedCourses = allocations.map((a) => a.course_id);

        // Force the queries to ONLY look at the trainer's allowed students
        studentWhere.center_id = { [Op.in]: allowedCenters };
        attendanceWhere.center_id = { [Op.in]: allowedCenters };
        studentWhere.course_id = { [Op.in]: allowedCourses };
        attendanceWhere.course_id = { [Op.in]: allowedCourses };

        targetCenterId = allowedCenters[0]; // Use trainer's first center for dates
      } else {
        // 3. ADMIN LOGIC: Only filter by center/course if they didn't select "All" (0)
        if (centerId && String(centerId) !== "0") {
          studentWhere.center_id = centerId;
          attendanceWhere.center_id = centerId;
        } else {
          targetCenterId = null; // We are looking at all centers
        }

        if (courseId && String(courseId) !== "0") {
          studentWhere.course_id = courseId;
          attendanceWhere.course_id = courseId;
        }
      }
    } else {
      // Fallback if no user_id is provided, but handle '0' values just in case
      if (centerId && String(centerId) !== "0") {
        studentWhere.center_id = centerId;
        attendanceWhere.center_id = centerId;
      } else {
        targetCenterId = null;
      }

      if (courseId && String(courseId) !== "0") {
        studentWhere.course_id = courseId;
        attendanceWhere.course_id = courseId;
      }
    }

    // 4. Get center dates (fallback to batch default if viewing "All Centers")
    const dateQuery = { tb_id: batchId };
    if (targetCenterId && String(targetCenterId) !== "0") {
      dateQuery.center_id = targetCenterId;
    }

    const centerDates = await CenterDates.findOne({
      where: dateQuery,
    });

    if (!centerDates) {
      return res.status(404).json({ message: "Center dates not found for this batch" });
    }

    // Fixed timezone-aware date handling
    const startDateString = new Date(centerDates.tb_start).toLocaleDateString(
      "en-CA",
      { timeZone: "Asia/Karachi" }
    );
    const currentDateString = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Karachi",
    });

    // Add date range to attendance where clause
    attendanceWhere.attend_date = { [Op.between]: [startDateString, currentDateString] };

    // 5. Execute Queries
    const students = await Student.findAll({
      where: studentWhere,
      raw: true,
    });
    
    const attendanceRecords = await Attendance.findAll({
      where: attendanceWhere,
      raw: true,
    });

    // 6. Calculate attendance stats
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLeave = 0;

    // First, group records by date and student, keeping only the latest entry
    const latestRecords = {};
    attendanceRecords.forEach((record) => {
      const key = `${record.attend_date}_${record.std_cnic}`;
      if (
        !latestRecords[key] ||
        new Date(record.createdAt) > new Date(latestRecords[key].createdAt)
      ) {
        latestRecords[key] = record;
      }
    });

    // Now process only the latest records
    const attendanceByDate = {};
    Object.values(latestRecords).forEach((record) => {
      const date = record.attend_date;
      const status = record.attend_status;

      // Skip if status is undefined, null, or "Not Set"
      if (!status || status === "Not Set") return;

      // Ensure the student is actually in our correctly filtered student list
      if (students.some((s) => s.std_cnic === record.std_cnic)) {
        if (!attendanceByDate[date]) {
          attendanceByDate[date] = { P: 0, A: 0, L: 0 };
        }

        switch (status) {
          case "P":
            totalPresent++;
            attendanceByDate[date].P++;
            break;
          case "A":
            totalAbsent++;
            attendanceByDate[date].A++;
            break;
          case "L":
            totalLeave++;
            attendanceByDate[date].L++;
            break;
        }
      }
    });

    // Calculate percentage safely to avoid dividing by zero
    const totalCalculated = totalPresent + totalAbsent + totalLeave;
    const attendancePercentage = totalCalculated > 0 
        ? ((totalPresent / totalCalculated) * 100).toFixed(2) 
        : "0.00";

    res.json({
      attendanceByDate,
      stats: {
        totalStudents: students.length,
        totalPresent,
        totalAbsent,
        totalLeave,
        attendancePercentage: attendancePercentage,
      },
      centersDates: [centerDates],
    });
  } catch (error) {
    console.error("Attendance fetch error:", error);
    res
      .status(500)
      .json({ message: "Server error fetching attendance records" });
  }
};
// Get Attendance Records
exports.getAttendance = async (req, res) => {
  try {
    // Extract query parameters
    const { date, batchId, user_id } = req.query;
    let centerId = 0,
      courseId = 0;
    // Validate query parameters
    if (!date || !batchId) {
      return res
        .status(400)
        .json({ message: "Missing required query parameters" });
    }
    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.user_type === "trainer") {
      const trainer = await Trainer.findOne({
        where: {
          user_id: user_id,
        },
      });
      if (trainer) {
        const trainerCenter = await TrainerCenterAllocation.findOne({
          where: {
            tb_id: batchId,
            t_id: trainer.t_id,
          },
        });
        centerId = trainerCenter.center_id;
        courseId = trainerCenter.course_id;
      } else {
        return res.status(404).json({ message: "Trainer not found" });
      }
    }
    let attend_status_Count_P = 0;
    let attend_status_Count_A = 0;
    let attend_status_Count_L = 0;

    // Fetch attendance records from the database
    const attendanceRecords = await Attendance.findAll({
      where: {
        attend_date: date,
        center_id: centerId,
        course_id: courseId,
        tb_id: batchId,
      },
      include: [
        {
          model: Center,
          attributes: ["center_name"],
        },
        {
          model: Course,
          attributes: ["course_name", "course_full_name"],
        },
      ],
    });

    // Count attendance statuses
    attendanceRecords.forEach((record) => {
      if (record.attend_status === "P") {
        attend_status_Count_P++;
      } else if (record.attend_status === "A") {
        attend_status_Count_A++;
      } else if (record.attend_status === "L") {
        attend_status_Count_L++;
      }
    });

    // Send response with attendance records and status counts
    res.json({
      attendanceRecords,
      attend_status_Count_P,
      attend_status_Count_A,
      attend_status_Count_L,
    });
  } catch (error) {
    console.error("Attendance fetch error:", error);
    // Send error response
    res
      .status(500)
      .json({ message: "Server error fetching attendance records" });
  }
};

// Update Attendance Record
exports.updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { attend_status } = req.body;

    const [updatedRowsCount] = await Attendance.update(
      { attend_status },
      { where: { attend_id: id } }
    );

    if (updatedRowsCount === 0) {
      return res.status(404).json({ message: "Attendance record not found" });
    }

    const updatedAttendance = await Attendance.findByPk(id);

    res.json({
      message: "Attendance record updated successfully",
      attendance: updatedAttendance,
    });
  } catch (error) {
    console.error("Attendance update error:", error);
    res
      .status(500)
      .json({ message: "Server error updating attendance record" });
  }
};

// Delete Attendance Record
exports.deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedRowCount = await Attendance.destroy({
      where: { attend_id: id },
    });

    if (deletedRowCount === 0) {
      return res.status(404).json({ message: "Attendance record not found" });
    }

    res.json({ message: "Attendance record deleted successfully" });
  } catch (error) {
    console.error("Attendance deletion error:", error);
    res
      .status(500)
      .json({ message: "Server error deleting attendance record" });
  }
};

// Generate Attendance Summary
exports.getAttendanceSummary = async (req, res) => {
  try {
    const { center_id, course_id, tb_id } = req.query;

    const whereCondition = {};
    if (center_id) whereCondition.center_id = center_id;
    if (course_id) whereCondition.course_id = course_id;
    if (tb_id) whereCondition.tb_id = tb_id;

    const summary = await Attendance.findAll({
      where: whereCondition,
      attributes: [
        "std_id",
        "std_cnic",
        [sequelize.fn("COUNT", sequelize.col("attend_id")), "total_classes"],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal('CASE WHEN attend_status = "P" THEN 1 ELSE 0 END')
          ),
          "present_count",
        ],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal('CASE WHEN attend_status = "A" THEN 1 ELSE 0 END')
          ),
          "absent_count",
        ],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal('CASE WHEN attend_status = "L" THEN 1 ELSE 0 END')
          ),
          "late_count",
        ],
      ],
      group: ["std_id", "std_cnic"],
      raw: true,
    });

    // Calculate attendance percentage
    const summaryWithPercentage = summary.map((item) => ({
      ...item,
      attendance_percentage: (
        (item.present_count / item.total_classes) *
        100
      ).toFixed(2),
    }));

    res.json(summaryWithPercentage);
  } catch (error) {
    console.error("Attendance summary error:", error);
    res
      .status(500)
      .json({ message: "Server error generating attendance summary" });
  }
};
