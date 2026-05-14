const Assignment = require("../models/assignmentModel");
const Center = require("../models/center");
const Course = require("../models/course");
const TrainingBatch = require("../models/trainingBatcheModel");
const Trainer = require("../models/trainersModel");
const trainers_center_allocation = require("../models/trainersCenterAllocationModel");
const User = require("../models/userModel");
const Student = require("../models/studentModel");
const AssignmentSubmission = require("../models/assignmentSubmissionModel");
const { validationResult } = require("express-validator");
const { sequelize } = require("../config/db");
// Create Assignment
exports.createAssignment = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { as_title, as_description, as_deadline, as_marks, tb_id, user_id } =
      req.body;

    // Validate training batch
    const trainingBatch = await TrainingBatch.findByPk(tb_id);
    if (!trainingBatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid training batch",
      });
    }

    // Find trainer
    const trainer = await Trainer.findOne({
      where: { user_id: user_id },
      raw: true,
    });

    if (!trainer) {
      return res.status(400).json({
        success: false,
        message: "Trainer not found",
      });
    }

    // Find all trainer's center allocations for this batch
    const trainerAllocations = await trainers_center_allocation.findAll({
      where: {
        t_id: trainer.t_id,
        tb_id: tb_id,
      },
      raw: true,
    });

    if (!trainerAllocations || trainerAllocations.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Trainer is not allocated to this batch",
      });
    }

    const as_attachment = req.file
      ? `/uploads/user-assignments/${req.file.filename}`
      : "";

    // Create assignments for each center-course allocation
    const createdAssignments = [];

    // Use transaction to ensure all assignments are created or none
    const result = await sequelize.transaction(async (t) => {
      for (const allocation of trainerAllocations) {
        const newAssignment = await Assignment.create(
          {
            as_title,
            as_description,
            as_attachment,
            as_deadline,
            as_marks,
            t_id: trainer.t_id,
            tb_id,
            course_id: allocation.course_id,
            center_id: allocation.center_id,
            as_added_on: new Date().toISOString().split("T")[0],
          },
          { transaction: t }
        );

        createdAssignments.push(newAssignment);
      }

      return createdAssignments;
    });

    res.status(201).json({
      success: true,
      message: `Assignment created successfully for ${
        createdAssignments.length
      } center${createdAssignments.length > 1 ? "s" : ""}`,
      data: createdAssignments,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error creating assignment",
      error: error.message,
    });
  }
};

// Get Assignment by ID
exports.getAssignmentById = async (req, res) => {
  try {
    const { tb_id } = req.params;
    const assignment = await Assignment.findByPk(id, {
      where: { tb_id },
      include: [
        { model: Center, as: "center", attributes: ["center_name"] },
        { model: Course, as: "course", attributes: ["course_name"] },
        { model: TrainingBatch, as: "trainingBatch", attributes: ["tb_name"] },
      ],
    });
    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    res.json(assignment);
  } catch (error) {
    console.error("Assignment fetch error:", error);
    res.status(500).json({ message: "Server error fetching assignment" });
  }
};

// Get All Assignments
exports.getAllAssignmentsByTB = async (req, res) => {
  try {
    const { tb_id } = req.params;
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const user = await User.findByPk(user_id, {
      raw: true,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let whereClause = { tb_id };
    let studentRollno = null;

    // Handle different user types
    if (user.user_type === "trainer") {
      const trainer = await Trainer.findOne({
        where: { user_id: user_id },
        raw: true,
      });

      if (trainer) {
        const trainerCenter = await trainers_center_allocation.findOne({
          where: {
            t_id: trainer.t_id,
            tb_id,
          },
          raw: true,
        });

        if (trainerCenter) {
          whereClause = {
            ...whereClause,
            t_id: trainer.t_id,
          };
        }
      }
    } else if (user.user_type === "student") {
      const student = await Student.findOne({
        where: { user_id: user_id },
        raw: true,
      });

      if (student) {
        studentRollno = student.std_rollno;
        whereClause = {
          ...whereClause,
          center_id: student.center_id,
          course_id: student.course_id,
        };
      }
    }

    const assignments = await Assignment.findAll({
      where: whereClause,
      include: [
        {
          model: Course,
          attributes: ["course_name"],
        },
        {
          model: Center,
          attributes: ["center_name"],
        },
        {
          model: TrainingBatch,
          attributes: ["tb_name"],
        },
        {
          model: Trainer,
          attributes: ["user_id"],
          include: [
            {
              model: User,
              as: "user",
              attributes: ["user_id", "user_name", "user_email"],
            },
          ],
        },
      ],
      order: [["as_added_on", "DESC"]],
    });

    // Enhanced assignments data with submission statistics
    const enhancedAssignments = await Promise.all(
      assignments.map(async (assignment) => {
        const plainAssignment = assignment.get({ plain: true });

        if (user.user_type === "trainer") {
          // Get submission statistics for trainer
          const submissions = await AssignmentSubmission.findAll({
            where: {
              as_id: assignment.as_id,
              tb_id: tb_id,
            },
            raw: true,
          });

          // Count students in this assignment's center and course
          const totalStudents = await Student.count({
            where: {
              tb_id: tb_id,
              center_id: assignment.center_id,
              course_id: assignment.course_id,
            },
          });

          // Calculate statistics
          const submissionCount = submissions.length;
          const pendingCount = totalStudents - submissionCount;

          // Calculate average marks if there are submissions with marks
          let avgMarks = 0;
          const markedSubmissions = submissions.filter(
            (sub) => sub.obt_marks && parseFloat(sub.obt_marks) > 0
          );

          if (markedSubmissions.length > 0) {
            const totalMarks = markedSubmissions.reduce(
              (sum, sub) => sum + parseFloat(sub.obt_marks),
              0
            );
            avgMarks = (totalMarks / markedSubmissions.length).toFixed(1);
          }

          return {
            ...plainAssignment,
            statistics: {
              submissionCount,
              pendingCount,
              totalStudents,
              avgMarks,
            },
          };
        } else if (user.user_type === "student" && studentRollno) {
          // Get student's submission for this assignment if any
          const studentSubmission = await AssignmentSubmission.findOne({
            where: {
              as_id: assignment.as_id,
              std_rollno: studentRollno,
            },
            raw: true,
          });

          return {
            ...plainAssignment,
            studentStats: {
              hasSubmitted: !!studentSubmission,
              obtainedMarks: studentSubmission
                ? studentSubmission.obt_marks
                : null,
              submissionStatus: studentSubmission
                ? studentSubmission.as_submission_status
                : null,
              submissionDate: studentSubmission
                ? studentSubmission.submitted_on
                : null,
              status: studentSubmission
                ? studentSubmission.as_submission_status
                : null,
            },
          };
        }

        return plainAssignment;
      })
    );

    return res.status(200).json({
      success: true,
      data: enhancedAssignments,
    });
  } catch (error) {
    console.error("Error fetching assignments:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching assignments",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
// Update Assignment
exports.updateAssignment = async (req, res) => {
  try {
    const { as_id } = req.params;
    const {
      as_title,
      as_description,
      as_instructions,
      as_marks,
      as_deadline,
      as_status,
    } = req.body;

    const updatedRowsCount = await Assignment.update(
      {
        as_title,
        as_description,
        as_instructions,
        as_marks,
        as_deadline,
        as_status,
      },
      { where: { as_id: as_id } }
    );

    if (updatedRowsCount === 0) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    const updatedAssignment = await Assignment.findByPk(as_id);

    res.json({
      message: "Assignment updated successfully",
      assignment: updatedAssignment,
    });
  } catch (error) {
    console.error("Assignment update error:", error);
    res.status(500).json({ message: "Server error updating assignment" });
  }
};

// Delete Assignment
exports.deleteAssignment = async (req, res) => {
  try {
    const { id } = req.params;

    const assignment = await Assignment.findByPk(id);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found",
      });
    }

    const result = await sequelize.transaction(async (t) => {
      const submissionsDeleted = await AssignmentSubmission.destroy({
        where: { as_id: id },
        transaction: t,
      });

      // Then delete the assignment itself
      const assignmentDeleted = await Assignment.destroy({
        where: { as_id: id },
        transaction: t,
      });

      return { submissionsDeleted, assignmentDeleted };
    });

    res.json({
      success: true,
      message: "Assignment and all associated submissions deleted successfully",
      data: {
        submissionsDeleted: result.submissionsDeleted,
        assignmentDeleted: result.assignmentDeleted,
      },
    });
  } catch (error) {
    console.error("Assignment deletion error:", error);
    res.status(500).json({
      success: false,
      message: "Server error deleting assignment",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
