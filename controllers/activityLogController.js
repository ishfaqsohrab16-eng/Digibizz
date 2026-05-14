const ActivityLog = require("../models/activityLogModel");
const Center = require("../models/center");
const Course = require("../models/course");
const TrainingBatch = require("../models/trainingBatcheModel");
const Student = require("../models/studentModel");
const Assignment = require("../models/assignmentModel");
const AssignmentSubmission = require("../models/assignmentSubmissionModel");
const Tiket = require("../models/ticketModel");
const earning = require("../models/earningsModel");
const { validationResult } = require("express-validator");

// Create Activity Log
exports.createActivityLog = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      user_type,
      user_id,
      course_id,
      center_id,
      tb_id,
      act_type,
      act_descrip,
      act_content,
    } = req.body;

    // Validate foreign keys
    const center = await Center.findByPk(center_id);
    const course = await Course.findByPk(course_id);
    const trainingBatch = await TrainingBatch.findByPk(tb_id);

    if (!center || !course || !trainingBatch) {
      return res
        .status(400)
        .json({ message: "Invalid center, course, or training batch" });
    }

    // Create new activity log
    const newActivityLog = await ActivityLog.create({
      user_type,
      user_id,
      course_id,
      center_id,
      tb_id,
      act_type,
      act_descrip,
      act_content,
    });

    res.status(201).json({
      message: "Activity log created successfully",
      activityLog: {
        id: newActivityLog.act_id,
        userType: newActivityLog.user_type,
        userId: newActivityLog.user_id,
        courseId: newActivityLog.course_id,
        centerId: newActivityLog.center_id,
        trainingBatchId: newActivityLog.tb_id,
        activityType: newActivityLog.act_type,
        description: newActivityLog.act_descrip,
        content: newActivityLog.act_content,
      },
    });
  } catch (error) {
    console.error("Activity log creation error:", error);
    res
      .status(500)
      .json({ message: "Server error during activity log creation" });
  }
};

// Get All Activity Logs
exports.getAllActivityLogs = async (req, res) => {
  try {
    const { tb_id } = req.params;
    
    // Fetch all data in parallel for better performance
    const [activityLogs, students, assignments, assignmentSubmissions, tickets, earnings] = await Promise.all([
      ActivityLog.findAll({
        where: { tb_id: tb_id },
        order: [["act_on", "DESC"]],
        attributes: ['act_id', 'user_type', 'user_id', 'course_id', 'center_id', 'tb_id', 'act_type', 'act_descrip', 'act_content', 'act_on'], // Only select needed fields
        raw: true, // Get plain objects for faster processing
      }),
      Student.findAll({
        where: { tb_id: tb_id },
        attributes: ['std_id', 'std_rollno', 'std_lms_status', 'suspension_reason'], // Only needed fields
        raw: true,
      }),
      Assignment.findAll({
        where: { tb_id: tb_id },
        attributes: ['as_id'], // Only count needed
        raw: true,
      }),
      AssignmentSubmission.findAll({
        where: { tb_id: tb_id },
        attributes: ['as_submission_id'], // Only count needed
        raw: true,
      }),
      Tiket.findAll({
        where: { tb_id: tb_id },
        attributes: ['ticket_id', 'ticket_status'], // Only needed fields
        raw: true,
      }),
      earning.findAll({
        where: { tb_id: tb_id },
        attributes: ['earning_id', 'std_id', 'earning_status', 'earning_amount'], // Only needed fields
        raw: true,
      })
    ]);

    // Process activity logs to include additional information
    const stats = {
      enrolled: students.length,
      active: students.filter(
        (student) =>
          student.std_lms_status === 1 && student.suspension_reason == ""
      ).length,
      inactive: students.filter(
        (student) =>
          student.std_rollno === "" && student.std_lms_status === 0
      ).length,
      suspended: students.filter((student) => student.std_lms_status === 2)
        .length,
      stories: (() => {
        // Filter logs with act_type === "story" and earning_status === 1, then count unique std_id
        const filtered = earnings.filter(
          (log) => log.earning_status === 1 && log.std_id
        );
        const uniqueStdIds = new Set(filtered.map(log => log.std_id));
        return uniqueStdIds.size;
      })(),
      batchEarning: earnings
        .filter(earn => earn.earning_status === 1)
        .reduce((sum, earn) => sum + (parseFloat(earn.earning_amount) || 0), 0),
      assignments: assignments.length,
      allTickets: tickets.length,
      unAnswered: tickets.filter((ticket) => ticket.ticket_status === "OPEN").length,
      submissions: assignmentSubmissions.length,
    };


    res.json({
      activityLogs,
      statistics: stats,
    });
  } catch (error) {
    console.error("Fetch activity logs error:", error);
    res.status(500).json({ message: "Server error fetching activity logs" });
  }
};

// Get Activity Logs by User
exports.getActivityLogsByUser = async (req, res) => {
  try {
    const { user_id, user_type } = req.params;

    const activityLogs = await ActivityLog.findAll({
      where: { user_id, user_type },
      include: [
        { model: Center, as: "center", attributes: ["center_name"] },
        { model: Course, as: "course", attributes: ["course_name"] },
        { model: TrainingBatch, as: "trainingBatch", attributes: ["tb_name"] },
      ],
      order: [["act_on", "DESC"]],
    });

    res.json(activityLogs);
  } catch (error) {
    console.error("Fetch user activity logs error:", error);
    res
      .status(500)
      .json({ message: "Server error fetching user activity logs" });
  }
};
