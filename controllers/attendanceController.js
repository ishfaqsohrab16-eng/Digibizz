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
// config/db exports { sequelize, testConnection } - the previous code assigned
// the whole module here, so every sequelize.fn() call was a TypeError.
const { sequelize } = require("../config/db");
const {
  getClassAttendanceStats,
  getStudentAttendanceStats,
  getStudentAttendanceTimeline,
  toDateKey,
} = require("../utils/attendanceCalculator");
const { ROLES, ADMIN_ROLES } = require("../middleware/authMiddleware");


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

    const { tb_id } = attendanceRecords[0];

    if (!tb_id) {
      return res.status(400).json({ message: "Batch ID is required" });
    }

    // Identify the marker from the verified token. The client used to supply
    // `user_id` in the request body, so one trainer could mark attendance as
    // another and reach centers they are not allocated to.
    const markerUserId = req.user.id;

    // Find trainer
    // Only trainers are restricted to allocations. Staff roles (admin, master
    // trainer, center manager) may mark for the whole batch - previously this
    // function demanded a Trainer row for whoever was marking, so an admin
    // marking attendance always got a 404 "Trainer not found".
    const isTrainer = req.user.role === ROLES.TRAINER;

    // null means "no allocation restriction".
    let trainerCenterCourseMap = null;

    if (isTrainer) {
      const trainer = await Trainer.findOne({
        where: { user_id: markerUserId },
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

      trainerCenterCourseMap = new Map();
      trainerCenterAllocations.forEach((allocation) => {
        const key = `${allocation.center_id}_${allocation.course_id}`;
        trainerCenterCourseMap.set(key, allocation);
      });
    }

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
    const skippedStudents = [];

    attendanceRecords.forEach((record) => {
      const studentInfo = studentCenterMap.get(record.std_cnic);
      
      if (!studentInfo) {
        // Student not found in the database
        return;
      }

      const centerCourseKey = `${studentInfo.center_id}_${studentInfo.course_id}`;

      // Trainers may only mark their allocated center/course combinations;
      // staff roles have no allocation restriction.
      const allowed =
        trainerCenterCourseMap === null ||
        trainerCenterCourseMap.has(centerCourseKey);

      if (!allowed) {
        unauthorizedStudents.push(record.std_cnic);
        return;
      }

      const status = String(record.attend_status || "").trim().toUpperCase();
      // "Not Set" and anything else invalid must never reach the database: the
      // column only accepts P/A/L and a bad value fails the whole bulk insert.
      if (!["P", "A", "L"].includes(status)) {
        skippedStudents.push(record.std_cnic);
        return;
      }

      recordsToCreate.push({
        std_cnic: record.std_cnic,
        attend_status: status,
        attend_date: record.attend_date,
        center_id: studentInfo.center_id, // Use student's actual center_id
        course_id: studentInfo.course_id, // Use student's actual course_id
        tb_id: tb_id,
      });
    });

    if (recordsToCreate.length === 0) {
      return res.status(403).json({
        message:
          unauthorizedStudents.length > 0
            ? "You are not authorized to mark attendance for any of these students"
            : "No valid attendance statuses were supplied",
        unauthorizedStudents,
        skippedStudents,
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
      skippedStudents: skippedStudents.length > 0 ? skippedStudents : undefined,
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
    if (!Array.isArray(attendanceRecords) || attendanceRecords.length === 0) {
      return res.status(400).json({ message: "Invalid attendance records format" });
    }

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

    // A trainer may only write into center/course combinations they are
    // allocated to. Previously this endpoint accepted whatever center_id and
    // course_id the client sent, so a trainer could write attendance for any
    // center in the program.
    if (req.user.role === ROLES.TRAINER) {
      const trainer = await Trainer.findOne({ where: { user_id: req.user.id } });
      if (!trainer) {
        return res.status(404).json({ message: "Trainer not found" });
      }

      const allocations = await TrainerCenterAllocation.findAll({
        where: { t_id: trainer.t_id },
        raw: true,
      });
      const allowed = new Set(
        allocations.map((a) => `${a.tb_id}_${a.center_id}_${a.course_id}`)
      );

      const unauthorized = attendanceRecords.filter(
        (record) =>
          !allowed.has(`${record.tb_id}_${record.center_id}_${record.course_id}`)
      );

      if (unauthorized.length > 0) {
        return res.status(403).json({
          message:
            "You are not assigned to every center/course in this submission",
          unauthorizedCount: unauthorized.length,
        });
      }
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

    // 2. Enforce trainer allocations.
    //
    // The role now comes from the verified token (req.user), never from the
    // query string. Previously `user_id` was read from req.query, so omitting
    // it dropped into the unscoped branch below and returned every center, and
    // passing someone else's id borrowed their scope.
    {
      if (req.user.role === ROLES.TRAINER) {
        const trainer = await Trainer.findOne({ where: { user_id: req.user.id } });

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

        // A trainer allocated to several centers should be able to narrow to
        // one of them; only fall back to the first when they haven't chosen.
        targetCenterId =
          centerId && allowedCenters.map(String).includes(String(centerId))
            ? centerId
            : allowedCenters[0];
      } else {
        // 3. Staff: only filter by center/course if they didn't select "All" (0)
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
    //
    // De-duplication is done by highest attend_id. The old code compared
    // `record.createdAt`, which is always undefined because the Attendance
    // model sets timestamps:false - so the comparison was always false and it
    // silently kept whichever row the database happened to return first.
    const enrolledCnics = new Set(students.map((student) => student.std_cnic));
    const winners = new Map();

    attendanceRecords.forEach((record) => {
      if (!enrolledCnics.has(record.std_cnic)) return;

      const dateKey = toDateKey(record.attend_date);
      if (!dateKey) return;

      const status = String(record.attend_status || "").trim().toUpperCase();
      if (!["P", "A", "L"].includes(status)) return; // ignores "Not Set"

      const key = `${dateKey}_${record.std_cnic}`;
      const current = winners.get(key);
      if (!current || Number(record.attend_id) > Number(current.attend_id)) {
        winners.set(key, { attend_id: record.attend_id, dateKey, status });
      }
    });

    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLeave = 0;
    const attendanceByDate = {};

    winners.forEach(({ dateKey, status }) => {
      if (!attendanceByDate[dateKey]) {
        attendanceByDate[dateKey] = { P: 0, A: 0, L: 0 };
      }
      attendanceByDate[dateKey][status] += 1;
      if (status === "P") totalPresent += 1;
      else if (status === "A") totalAbsent += 1;
      else totalLeave += 1;
    });

    // Same rule as every other screen: approved leave counts as present, and
    // the denominator is the days actually marked.
    const totalCalculated = totalPresent + totalAbsent + totalLeave;
    const attendancePercentage =
      totalCalculated > 0
        ? (((totalPresent + totalLeave) / totalCalculated) * 100).toFixed(2)
        : "0.00";

    // The client sends `month` for the calendar it is displaying. It used to be
    // validated and then ignored, so the header said "August" while the totals
    // covered the whole batch. Report both.
    const monthKey = String(month).slice(0, 7);
    let monthPresent = 0;
    let monthAbsent = 0;
    let monthLeave = 0;
    Object.entries(attendanceByDate).forEach(([dateKey, counts]) => {
      if (dateKey.slice(0, 7) !== monthKey) return;
      monthPresent += counts.P;
      monthAbsent += counts.A;
      monthLeave += counts.L;
    });
    const monthTotal = monthPresent + monthAbsent + monthLeave;

    res.json({
      attendanceByDate,
      stats: {
        totalStudents: students.length,
        totalPresent,
        totalAbsent,
        totalLeave,
        attendancePercentage,
        classDaysHeld: Object.keys(attendanceByDate).length,
      },
      monthStats: {
        month: monthKey,
        totalPresent: monthPresent,
        totalAbsent: monthAbsent,
        totalLeave: monthLeave,
        classDaysHeld: Object.keys(attendanceByDate).filter(
          (dateKey) => dateKey.slice(0, 7) === monthKey
        ).length,
        attendancePercentage:
          monthTotal > 0
            ? (((monthPresent + monthLeave) / monthTotal) * 100).toFixed(2)
            : "0.00",
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
    const { date, batchId } = req.query;
    // Validate query parameters
    if (!date || !batchId) {
      return res
        .status(400)
        .json({ message: "Missing required query parameters" });
    }

    // Scope comes from the verified token, never from req.query.
    //
    // centerId/courseId used to default to 0 and were only assigned for
    // trainers, so every other role queried `center_id: 0` and always got an
    // empty result. The UI read that as "no attendance marked yet" and happily
    // let admins submit the same day again, creating duplicate rows.
    const attendanceWhere = { attend_date: date, tb_id: batchId };

    if (req.user.role === ROLES.TRAINER) {
      const trainer = await Trainer.findOne({ where: { user_id: req.user.id } });
      if (!trainer) {
        return res.status(404).json({ message: "Trainer not found" });
      }

      const allocations = await TrainerCenterAllocation.findAll({
        where: { tb_id: batchId, t_id: trainer.t_id },
        raw: true,
      });

      // Previously this used findOne and dereferenced the result without a null
      // check, so an unallocated trainer crashed the request with a 500.
      if (allocations.length === 0) {
        return res
          .status(403)
          .json({ message: "Trainer not assigned to this batch" });
      }

      attendanceWhere.center_id = {
        [Op.in]: allocations.map((allocation) => allocation.center_id),
      };
      attendanceWhere.course_id = {
        [Op.in]: allocations.map((allocation) => allocation.course_id),
      };
    } else {
      // Staff may narrow by center/course; "0" or absent means "all".
      const { centerId, courseId } = req.query;
      if (centerId && String(centerId) !== "0") attendanceWhere.center_id = centerId;
      if (courseId && String(courseId) !== "0") attendanceWhere.course_id = courseId;
    }

    let attend_status_Count_P = 0;
    let attend_status_Count_A = 0;
    let attend_status_Count_L = 0;

    // Fetch attendance records from the database
    const attendanceRecords = await Attendance.findAll({
      where: attendanceWhere,
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
//
// Rewritten to use the shared calculator. The previous version could never
// succeed: it grouped by `std_id` (not a column on this model) and called
// sequelize.fn() on the config module rather than the Sequelize instance.
exports.getAttendanceSummary = async (req, res) => {
  try {
    const { center_id, course_id, tb_id } = req.query;

    if (!tb_id) {
      return res.status(400).json({ message: "tb_id is required" });
    }

    const students = await Student.findAll({
      where: {
        tb_id,
        std_lms_status: { [Op.ne]: 2 },
        ...(center_id && String(center_id) !== "0" ? { center_id } : {}),
        ...(course_id && String(course_id) !== "0" ? { course_id } : {}),
      },
      attributes: ["std_cnic", "std_rollno", "center_id", "course_id"],
      raw: true,
    });

    const { byStudent } = await getClassAttendanceStats({
      tb_id,
      center_id: center_id && String(center_id) !== "0" ? center_id : undefined,
      course_id: course_id && String(course_id) !== "0" ? course_id : undefined,
      cnics: students.map((student) => student.std_cnic),
    });

    const summary = students.map((student) => {
      const stats = byStudent.get(String(student.std_cnic)) || {};
      return {
        std_cnic: student.std_cnic,
        std_rollno: student.std_rollno,
        center_id: student.center_id,
        course_id: student.course_id,
        first_marked_date: stats.firstMarkedDate || null,
        total_classes: stats.daysCounted || 0,
        present_count: stats.present || 0,
        absent_count: stats.absent || 0,
        leave_count: stats.leave || 0,
        unmarked_days: stats.unmarkedDays || 0,
        attendance_percentage: stats.percentage || 0,
      };
    });

    res.json(summary);
  } catch (error) {
    console.error("Attendance summary error:", error);
    res
      .status(500)
      .json({ message: "Server error generating attendance summary" });
  }
};

/**
 * Day-by-day attendance calendar for ONE student.
 *
 * Serves every role from a single implementation so the percentage a student
 * sees always matches what staff see:
 *   student        -> always their own record, whatever std_cnic they send
 *   trainer        -> only students in a center+course they are allocated to
 *   master trainer -> any student
 *   admins         -> any student
 */
exports.getStudentAttendanceCalendar = async (req, res) => {
  try {
    const role = req.user.role;
    const isStudent = role === ROLES.STUDENT;

    let student;

    if (isStudent) {
      // Ignore any std_cnic in the query: students only ever see themselves.
      student = await Student.findOne({
        where: { user_id: req.user.id },
        attributes: ["std_cnic", "std_rollno", "center_id", "course_id", "tb_id", "std_added_on"],
        raw: true,
      });
      if (!student) {
        return res.status(404).json({ message: "Student profile not found" });
      }
    } else {
      const { std_cnic, tb_id } = req.query;
      if (!std_cnic) {
        return res.status(400).json({ message: "std_cnic is required" });
      }

      student = await Student.findOne({
        where: { std_cnic, ...(tb_id ? { tb_id } : {}) },
        attributes: ["std_cnic", "std_rollno", "center_id", "course_id", "tb_id", "std_added_on"],
        raw: true,
      });
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Trainers are limited to their own allocations.
      if (role === ROLES.TRAINER) {
        const trainer = await Trainer.findOne({ where: { user_id: req.user.id } });
        if (!trainer) {
          return res.status(404).json({ message: "Trainer not found" });
        }
        const allocated = await TrainerCenterAllocation.findOne({
          where: {
            t_id: trainer.t_id,
            tb_id: student.tb_id,
            center_id: student.center_id,
            course_id: student.course_id,
          },
        });
        if (!allocated) {
          return res
            .status(403)
            .json({ message: "You are not assigned to this student's center and course" });
        }
      } else if (
        !ADMIN_ROLES.includes(role) &&
        role !== ROLES.CENTER_MANAGER
      ) {
        return res.status(403).json({ message: "You do not have permission to view this" });
      }
    }

    const timeline = await getStudentAttendanceTimeline({
      std_cnic: student.std_cnic,
      tb_id: student.tb_id,
      center_id: student.center_id,
      course_id: student.course_id,
    });

    const [center, course] = await Promise.all([
      Center.findByPk(student.center_id, { attributes: ["center_name"] }),
      Course.findByPk(student.course_id, {
        attributes: ["course_name", "course_full_name"],
      }),
    ]);

    res.json({
      student: {
        std_cnic: student.std_cnic,
        std_rollno: student.std_rollno,
        center_id: student.center_id,
        course_id: student.course_id,
        tb_id: student.tb_id,
        center_name: center?.center_name || "",
        course_name: course?.course_full_name || course?.course_name || "",
        enrolled_on: student.std_added_on || null,
      },
      ...timeline,
    });
  } catch (error) {
    console.error("Student attendance calendar error:", error);
    res
      .status(500)
      .json({ message: "Server error fetching student attendance" });
  }
};
