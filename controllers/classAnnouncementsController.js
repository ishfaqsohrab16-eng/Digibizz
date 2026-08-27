const ClassAnnouncements = require("../models/classAnnouncementsModel");
const Trainer = require("../models/trainersModel");
const TrainerCenterAllocation = require("../models/trainersCenterAllocationModel");
const TrainingBatch = require("../models/trainingBatcheModel");
const Course = require("../models/course");
const Center = require("../models/center");
const MasterTrainer = require("../models/masterTrainersModel");
const User = require("../models/userModel"); // Add this line to import User model
const Student = require("../models/studentModel");
const sendEmail = require("../servec/emailConfig");
const { validationResult } = require("express-validator");
const { Op } = require("sequelize");
const { allocationScope } = require("../utils/trainerScope");

exports.createAnnouncement = async (req, res) => {
  try {
    const { ca_title, ca_message, t_id, tb_id, user_id } = req.body;

    const trainer = await Trainer.findOne({
      where: { user_id: user_id },
    });

    if (!trainer) {
      return res.status(404).json({
        success: false,
        message: "Trainer not found",
      });
    }

    // One announcement per class the trainer teaches.
    //
    // This used to take findOne and post to that single center and course, so
    // a trainer running online classes for three centers wrote an announcement
    // and two of those classes never saw it.
    const allocations = await TrainerCenterAllocation.findAll({
      where: { t_id: trainer.t_id, tb_id },
    });

    if (allocations.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Trainer is not allocated to this batch",
      });
    }

    // De-duplicated so a class allocated twice does not show the same
    // announcement twice.
    const seen = new Set();
    const classes = allocations.filter((allocation) => {
      const key = `${allocation.center_id}|${allocation.course_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const addedOn = new Date().toISOString().split("T")[0];

    const announcements = await ClassAnnouncements.bulkCreate(
      classes.map((allocation) => ({
        ca_title,
        ca_message,
        t_id: trainer.t_id,
        tb_id,
        course_id: allocation.course_id,
        center_id: allocation.center_id,
        ca_added_on: addedOn,
      }))
    );

    res.status(201).json({
      success: true,
      message:
        classes.length === 1
          ? "Announcement created successfully"
          : `Announcement posted to all ${classes.length} of your classes`,
      data: announcements,
      classes: classes.length,
    });
  } catch (error) {
    console.error("Error creating announcement:", error);
    res.status(500).json({
      success: false,
      message: "Error creating announcement",
      error: error.message,
    });
  }
};

exports.getAnnouncements = async (req, res) => {
  try {
    const { tb_id, user_id, user_type } = req.query;

    const whereClause = {};
    if (tb_id) whereClause.tb_id = tb_id;

    // Handle trainer specific announcements
    if (user_type === "trainer" && user_id) {
      try {
        const trainer = await Trainer.findOne({
          where: { user_id: user_id },
        });

        if (!trainer) {
          return res.status(404).json({
            success: false,
            message: "Trainer not found",
          });
        }

        const allocations = await TrainerCenterAllocation.findAll({
          where: { t_id: trainer.t_id, tb_id },
        });

        // Every class they teach, not the first one. Written as pairs rather
        // than IN(centers) AND IN(courses), which is the cross product and
        // would also match classes taught by somebody else.
        const scope = allocationScope(allocations);
        if (scope) {
          whereClause.t_id = trainer.t_id;
          Object.assign(whereClause, { [Op.and]: [scope] });
        }
      } catch (error) {
        console.error("Error finding trainer details:", error);
      }
    }

    // Handle master trainer specific announcements
    if (user_type === "MasterTrainer" && user_id) {
      const masterTrainer = await MasterTrainer.findOne({
        where: { user_id: user_id },
      });

      if (masterTrainer) {
        whereClause.course_id = masterTrainer.mt_course_id;
      }
    }
    if (user_type === "student" && user_id) {
      const student = await Student.findOne({
        where: { user_id: user_id },
      });
      if (student) {
        whereClause.course_id = student.course_id;
        whereClause.center_id = student.center_id;
        whereClause.tb_id = student.tb_id;
      }
    }
    const announcements = await ClassAnnouncements.findAll({
      where: whereClause,
      include: [
        {
          model: Trainer,
          as: "trainer",
          include: [
            {
              model: User,
              as: "user",
              attributes: ["user_name"],
            },
          ],
        },
        {
          model: Course,
          as: "course",
          attributes: ["course_name"],
        },
        {
          model: Center,
          as: "center",
          attributes: ["center_name"],
        },
        {
          model: TrainingBatch,
          as: "training_batch",
          attributes: ["tb_name"],
        },
      ],
      order: [["ca_added_on", "DESC"]],
    });

    res.status(200).json({
      success: true,
      data: announcements,
    });
  } catch (error) {
    console.error("Error fetching announcements:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching announcements",
      error: error.message,
    });
  }
};

exports.updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { ca_title, ca_message } = req.body;

    const announcement = await ClassAnnouncements.findByPk(id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found",
      });
    }

    await announcement.update({
      ca_title,
      ca_message,
    });

    res.status(200).json({
      success: true,
      message: "Announcement updated successfully",
      data: announcement,
    });
  } catch (error) {
    console.error("Error updating announcement:", error);
    res.status(500).json({
      success: false,
      message: "Error updating announcement",
      error: error.message,
    });
  }
};

exports.deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    const announcement = await ClassAnnouncements.findByPk(id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found",
      });
    }

    await announcement.destroy();

    res.status(200).json({
      success: true,
      message: "Announcement deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting announcement:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting announcement",
      error: error.message,
    });
  }
};

exports.notifyStudents = async (req, res) => {
  try {
    const { course_id, center_id, subject, message, tb_id } = req.body;

    // Find all students matching the criteria
    const students = await Student.findAll({
      where: {
        tb_id: tb_id,
        course_id: course_id,
        center_id: center_id,
      },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["user_email", "user_name"],
        },
      ],
    });
    if (!students.length) {
      return res.status(404).json({
        success: false,
        message: "No students found for the specified course and center",
      });
    }

    // Send emails to all matching students
    const emailPromises = students.map((student) => {
      if (student.user && student.user.user_email) {
        return sendEmail(
          student.user.user_email,
          subject,
          message, // plain text version
          `<p>${message}</p>` // HTML version
        );
      }
      return Promise.resolve(); // Skip if no email
    });

    await Promise.all(emailPromises);

    res.status(200).json({
      success: true,
      message: `Notification sent to ${students.length} students`,
      studentCount: students.length,
    });
  } catch (error) {
    console.error("Error sending student notifications:", error);
    res.status(500).json({
      success: false,
      message: "Error sending notifications",
      error: error.message,
    });
  }
};
