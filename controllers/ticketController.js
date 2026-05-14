const Ticket = require("../models/ticketModel");
const TicketReply = require("../models/ticketReplyModel");
const Student = require("../models/studentModel");
const Trainer = require("../models/trainersModel");
const TrainingBatch = require("../models/trainingBatcheModel");
const Center = require("../models/center");
const Course = require("../models/course");
const TrainerAlocation = require("../models/trainersCenterAllocationModel");
const User = require("../models/userModel");
const MasterTrainer = require("../models/masterTrainersModel");
const { validationResult } = require("express-validator");

// Create Ticket
exports.createTicket = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const {
      ticket_subject,
      ticket_description,
      ticket_date,
      ticket_to,
      ticket_time,
      ticket_status,
      user_id,
      center_id,
      course_id,
      tb_id,
    } = req.body;

    // Add the missing await keyword here
    const trainerAlocation = await TrainerAlocation.findOne({
      where: {
        tb_id: tb_id,
        center_id: center_id,
        course_id: course_id,
      },
    });
    const student = await Student.findOne({
      where: {
        user_id: user_id,
      },
    });
    if (!trainerAlocation) {
      return res.status(404).json({
        success: false,
        message:
          "Trainer not found for this batch, center and course combination",
      });
    }
    if (!student) {
      return res.status(404).json({
        success: false,
        message:
          "Student not found for this batch, center and course combination",
      });
    }
    const user_profile_photo = req.file
      ? `uploads/ticketAttachment/${req.file.filename}`
      : null;

    // Prepare ticket data from request body
    const ticketData = {
      ticket_no: `TKT-${Date.now()}`, // Generate a unique ticket number
      ticket_subject: req.body.ticket_subject,
      ticket_description: req.body.ticket_description,
      ticket_date: req.body.ticket_date,
      ticket_time: req.body.ticket_time,
      ticket_status: req.body.ticket_status || "OPEN",
      ticket_to: req.body.ticket_to,
      std_rollno: student.std_rollno,
      t_id: trainerAlocation.t_id, // Now this will have a value
      tb_id: req.body.tb_id,
      center_id: req.body.center_id,
      course_id: req.body.course_id,
      ticket_attachment: user_profile_photo,
    };

    // Create the ticket in the database
    const ticket = await Ticket.create(ticketData);

    res.status(201).json({
      success: true,
      message: "Ticket created successfully",
      data: ticket,
    });
  } catch (error) {
    console.error("Ticket creation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create ticket",
      error: error.message,
    });
  }
};

// Get All Tickets
exports.getAllTickets = async (req, res) => {
  try {
    const { tb_id, center_id, course_id, user_type, user_id } = req.query;

    // Build query conditions
    const whereClause = {};
    if (tb_id) whereClause.tb_id = tb_id;
    if (center_id) whereClause.center_id = center_id;
    if (course_id) whereClause.course_id = course_id;

    // Add student or trainer specific filters
    if (user_type === "student") {
      const student = await Student.findOne({ where: { user_id } });
      if (student) {
        whereClause.std_rollno = student.std_rollno;
      }
    } else if (user_type === "trainer") {
      const trainer = await Trainer.findOne({ where: { user_id } });
      if (trainer) {
        whereClause.t_id = trainer.t_id;
      }
    } else if (user_type === "MasterTrainer") {
      const masterTrainer = await MasterTrainer.findOne({ where: { user_id } });
      if (masterTrainer) {
        whereClause.course_id = masterTrainer.mt_course_id;
      }
    }

    const tickets = await Ticket.findAll({
      where: {
        ...whereClause,
        ...(user_type === "trainer" && { ticket_to: ["TRAINER", "trainer"] }),
        ...(user_type === "MasterTrainer" && { ticket_to: ["MT", "mt"] }),
      },
      include: [
        { model: Trainer, as: "trainers", attributes: ["t_id", "user_id"] },
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
      order: [["ticket_date", "DESC"]],
    });

    // Extract all `std_rollno` values from the tickets
    const stdRollnos = tickets.map((ticket) => ticket.std_rollno);

    // Fetch student data for all `std_rollno` values
    const studentData = await Student.findAll({
      where: { std_rollno: stdRollnos },
      include: [
        { model: User, as: "user", attributes: ["user_id", "user_name"] },
      ],
    });

    // Map `user_name` to each ticket based on `std_rollno`
    const studentMap = studentData.reduce((acc, student) => {
      acc[student.std_rollno] = student.user?.user_name || null;
      return acc;
    }, {});

    const ticketsWithUserName = tickets.map((ticket) => ({
      ...ticket.get({ plain: true }),
      user_name: studentMap[ticket.std_rollno] || null,
    }));

    res.status(200).json({ success: true, data: ticketsWithUserName });
  } catch (error) {
    console.error("Get tickets error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Ticket By ID
exports.getTicketById = async (req, res) => {
  try {
    const ticket = await Ticket.findByPk(req.params.id, {
      include: [
        { model: Trainer, as: "trainers" },
        { model: TrainingBatch, as: "training_batches" },
        { model: Center, as: "centers" },
        { model: Course, as: "courses" },
      ],
    });

    if (!ticket) {
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });
    }

    // Get all replies for the ticket
    const replies = await TicketReply.findOne({
      where: {
        ticket_no: ticket.ticket_no,
      },
      order: [
        ["reply_date", "ASC"],
        ["reply_time", "ASC"],
      ],
    });

    // Fetch student data for the ticket's `std_rollno`
    const student = await Student.findOne({
      where: {
        std_rollno: ticket.std_rollno,
      },
      include: [
        { model: User, as: "user", attributes: ["user_id", "user_name"] },
      ],
    });
    const trainer = await User.findOne({
      where: {
        user_id: ticket.trainers.user_id,
      },
    });

    // Convert the ticket to a plain object so we can modify it
    const ticketData = ticket.get({ plain: true });

    // Add `user_name` from the student data
    ticketData.user_name = student?.user?.user_name || null;

    ticketData.trainers.trainer_name = trainer?.user_name || null;

    // Add replies and student data to the ticket object
    ticketData.replies = replies;
    ticketData.student = student;

    res.status(200).json({ success: true, data: ticketData });
  } catch (error) {
    console.error("Get ticket error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update Ticket
exports.updateTicket = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) {
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });
    }

    await ticket.update(req.body);
    res.status(200).json({ success: true, data: ticket });
  } catch (error) {
    console.error("Update ticket error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Ticket
exports.deleteTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findByPk(req.params.id);
    if (!ticket) {
      return res
        .status(404)
        .json({ success: false, message: "Ticket not found" });
    }

    await ticket.destroy();
    res
      .status(200)
      .json({ success: true, message: "Ticket deleted successfully" });
  } catch (error) {
    console.error("Delete ticket error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create Ticket Reply
exports.createTicketReply = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    const { ticket_no, reply_by, reply_message, ticket_status } = req.body;

    // Check if the ticket exists
    const ticket = await Ticket.findOne({
      where: { ticket_no: ticket_no },
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    // Handle file upload for reply attachment
    const reply_attachment = req.file
      ? `uploads/replyAttachments/${req.file.filename}`
      : null;

    // Prepare reply data from request body
    const replyData = {
      ticket_no: ticket_no,
      reply_by: reply_by,
      reply_message: reply_message,
      reply_date: req.body.reply_date || format(new Date(), "yyyy-MM-dd"),
      reply_time: req.body.reply_time || format(new Date(), "HH:mm:ss"),
      reply_attachment: reply_attachment,
      ticket_id: ticket.ticket_id,
    };
    const existingReply = await TicketReply.findOne({
      where: { ticket_no: ticket_no },
    });
    let reply;
    if (existingReply) {
      const reply = await existingReply.update(replyData);
      reply = await existingReply.update(replyData);
    } else {
      reply = await TicketReply.create(replyData);
    }
    if (reply) {
      await ticket.update({
        ticket_status: ticket_status || "ANSWERED",
      });
    }

    res.status(201).json({
      success: true,
      message: "Reply added successfully",
      data: reply,
    });
  } catch (error) {
    console.error("Create reply error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create reply",
      error: error.message,
    });
  }
};

// Get Ticket Replies
exports.getTicketReplies = async (req, res) => {
  try {
    const { ticket_no } = req.params;

    const replies = await TicketReply.findAll({
      where: { ticket_no },
      order: [
        ["reply_date", "ASC"],
        ["reply_time", "ASC"],
      ],
    });

    res.status(200).json({ success: true, data: replies });
  } catch (error) {
    console.error("Get replies error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
