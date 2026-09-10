const ClassAnnouncements = require("../models/classAnnouncementsModel");
const Trainer = require("../models/trainersModel");
const TrainerCenterAllocation = require("../models/trainersCenterAllocationModel");
const { distinctClasses } = require("../utils/trainerScope");
const TrainingBatch = require("../models/trainingBatcheModel");
const Course = require("../models/course");
const Center = require("../models/center");
const MasterTrainer = require("../models/masterTrainersModel");
const User = require("../models/userModel"); // Add this line to import User model
const { classAnnouncement } = require("../servec/emailTemplates");
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
    // announcement twice. See distinctClasses for why the table allows it.
    const classes = distinctClasses(allocations);

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

/**
 * Gap between announcement emails.
 *
 * Short enough that a class of a hundred is notified in a couple of minutes,
 * long enough that the send does not look like a blast. The campaign
 * dispatcher paces for the same reason at a larger scale.
 */
const PER_MESSAGE_GAP_MS = Number(process.env.ANNOUNCEMENT_GAP_MS) || 400;

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

    // One at a time, with a gap. Promise.all fired every message at once,
    // which is a burst on any mail server and looks exactly like the traffic
    // blocklists are built to catch - and its first rejection abandoned the
    // rest, so a single bad address meant the remaining students silently
    // never heard from their trainer.
    const recipients = students.filter((student) => student.user?.user_email);
    const sent = [];
    const queued = [];
    const failed = [];

    for (let index = 0; index < recipients.length; index += 1) {
      const student = recipients[index];
      const address = student.user.user_email;

      try {
        const { subject: builtSubject, text, html } = classAnnouncement({
          name: student.user.user_name,
          subject,
          message,
        });

        // bulk: a class can be a hundred students, and this must not spend
        // the allowance held back for registration codes. Not noQueue,
        // though - nothing else retries these, so the outbox is what stops
        // an announcement being lost when a provider is having a bad minute.
        const result = await sendEmail({
          to: address,
          subject: builtSubject,
          text,
          html,
          bulk: true,
        });

        if (result?.queued) queued.push(address);
        else sent.push(address);
      } catch (error) {
        // One bad address must not cost the rest of the class their notice.
        const reason = String(error?.message || error).slice(0, 300);
        failed.push({ email: address, error: reason });
        console.error(`[announcement] ${address} failed:`, reason);
      }

      if (index < recipients.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, PER_MESSAGE_GAP_MS));
      }
    }

    const withoutEmail = students.length - recipients.length;

    res.status(200).json({
      success: true,
      message:
        `Notified ${sent.length} of ${students.length} student(s)` +
        (queued.length ? `; ${queued.length} queued for retry` : "") +
        (failed.length ? `; ${failed.length} failed` : "") +
        (withoutEmail ? `; ${withoutEmail} have no email address` : ""),
      studentCount: students.length,
      sent: sent.length,
      queued: queued.length,
      failed,
      withoutEmail,
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
