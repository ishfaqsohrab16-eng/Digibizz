const ExamAssessment = require("../models/examAssessmentModel");
const TrainingBatch = require("../models/trainingBatcheModel");
const Center = require("../models/center");
const Course = require("../models/course");
const Student = require("../models/studentModel");
const { Op } = require("sequelize");
const MasterTrainerModel = require("../models/masterTrainersModel");
const User = require("../models/userModel");
const Earning = require("../models/earningsModel");
// Create new exam assessment
exports.createExamAssessment = async (req, res) => {
  const { std_cnic, tb_id, center_id, course_id, ea_type } = req.body;

  try {
    // Check if the foreign key references exist
    const trainingBatchExists = await TrainingBatch.findByPk(tb_id);
    const centerExists = await Center.findByPk(center_id);
    const courseExists = await Course.findByPk(course_id);

    if (!trainingBatchExists || !centerExists || !courseExists) {
      return res.status(400).json({
        success: false,
        message: "Foreign key reference not found",
      });
    }

    // Check if student exists (by CNIC)
    const studentExists = await Student.findOne({
      where: { std_cnic },
    });

    if (!studentExists) {
      return res.status(400).json({
        success: false,
        message: "Student not found with the provided CNIC",
      });
    }

    // Check if assessment already exists for this student, batch and type
    const existingAssessment = await ExamAssessment.findOne({
      where: {
        std_cnic,
        tb_id,
        ea_type,
      },
    });

    if (existingAssessment) {
      // Update the existing assessment with new values
      const { class_participation, final_task, presentation, viva, remarks } =
        req.body;
      const total_score =
        parseFloat(class_participation) +
        parseFloat(final_task) +
        parseFloat(presentation) +
        parseFloat(viva);

      await existingAssessment.update({
        class_participation,
        final_task,
        presentation,
        viva,
        remarks,
        total_score: total_score.toFixed(1),
      });

      return res.status(200).json({
        success: true,
        message: `A ${ea_type} Exam assessment updated successfully`,
        data: existingAssessment,
      });
    }

    // Calculate total score from individual components
    const { class_participation, final_task, presentation, viva } = req.body;
    const total_score =
      parseFloat(class_participation) +
      parseFloat(final_task) +
      parseFloat(presentation) +
      parseFloat(viva);

    // Create the exam assessment with calculated total
    const examAssessment = await ExamAssessment.create({
      ...req.body,
      total_score: total_score.toFixed(1),
    });

    return res.status(201).json({
      success: true,
      message: "Exam assessment created successfully",
      data: examAssessment,
    });
  } catch (error) {
    console.error("Exam assessment creation error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during exam assessment creation",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.getFinalExamAssessments = async (req, res) => {
  const { std_cnic, tb_id, ea_type } = req.params;

  try {
    const examAssessment = await ExamAssessment.findAll({
      where: {
        std_cnic,
        tb_id,
        ea_type,
      },
      include: [
        { model: TrainingBatch, as: "training_batches" },
        { model: Center, as: "centers" },
        { model: Course, as: "courses" },
      ],
    });

    return res.status(200).json({
      success: true,
      data: examAssessment, // Handle null case
    });
  } catch (error) {
    console.error("Error fetching final exam assessments:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching final exam assessments",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
// Get mid-term exam assessments
exports.getExamAssessmentsBytb = async (req, res) => {
  const { tb_id, user_type, user_id, ea_type } = req.params;
  try {
    const whereClause = { tb_id };
    if (ea_type) {
      whereClause.ea_type = ea_type;
    }
    if (user_type === "MasterTrainer") {
      const mt = await MasterTrainerModel.findOne({
        where: { user_id: user_id },
      });
      if (!mt) {
        return res.status(404).json({
          success: false,
          message: "Master Trainer not found",
        });
      }
      whereClause.course_id = mt.mt_course_id;
    }

    const examAssessments = await ExamAssessment.findAll({
      where: whereClause,
      include: [
        { model: TrainingBatch, as: "training_batches" },
        { model: Center, as: "centers" },
        { model: Course, as: "courses" },
      ],
    });

    let assessmentsWithStudents = await Promise.all(
      examAssessments.map(async (assessment) => {
        const student = await Student.findOne({
          where: { std_cnic: assessment.std_cnic },
          include: [{ model: User, as: "user" }],
        });
        const totalEarnings =
          (await Earning.sum("earning_amount", {
            where: {
              std_id: student ? student.std_id : null,
              tb_id: assessment.tb_id,
            },
          })) || 0;

        return {
          ...assessment.toJSON(),
          student: student
            ? {
                ...student.toJSON(),
                totalEarnings,
              }
            : null,
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: examAssessments.length,
      data: assessmentsWithStudents,
    });
  } catch (error) {
    console.error("Error fetching mid-term exam assessments:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching exam assessments",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
// get all exam assessments to create the charts as master report
exports.getExamAssessmentsAll = async (req, res) => {
  try {

    const examAssessments = await ExamAssessment.findAll({
      where: {
        ea_type: "Final",
        total_score: { [Op.gte]: 60 }
      },
      include: [
        { model: TrainingBatch, as: "training_batches" },
        { model: Center, as: "centers" },
        { model: Course, as: "courses" },
      ],
    });

    let assessmentsWithStudents = await Promise.all(
      examAssessments.map(async (assessment) => {
        const student = await Student.findOne({
          where: { std_cnic: assessment.std_cnic },
          include: [{ model: User, as: "user" }],
        });
        const totalEarnings =
          (await Earning.sum("earning_amount", {
            where: {
              std_id: student ? student.std_id : null,
              tb_id: assessment.tb_id,
            },
          })) || 0;

        return {
          ...assessment.toJSON(),
          student: student
            ? {
                ...student.toJSON(),
                totalEarnings,
              }
            : null,
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: examAssessments.length,
      data: assessmentsWithStudents,
    });
  } catch (error) {
    console.error("Error fetching mid-term exam assessments:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching exam assessments",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
// Get all exam assessments for a training batch
exports.getBatchExamAssessments = async (req, res) => {
  const { tb_id, user_type, user_id } = req.params;
  const { ea_type } = req.query;

  try {
    const whereClause = { tb_id };
    if (ea_type) {
      whereClause.ea_type = ea_type;
    }
    if (user_type === "MasterTrainer") {
      const mt = MasterTrainerModel.findOne({
        where: { user_id },
      });
      if (!mt) {
        return res.status(404).json({
          success: false,
          message: "Master Trainer not found",
        });
      }
      whereClause.course_id = mt.mt_course_id;
    }
    const examAssessments = await ExamAssessment.findAll({
      where: whereClause,
      include: [
        { model: TrainingBatch, as: "training_batches" },
        { model: Center, as: "centers" },
        { model: Course, as: "courses" },
      ],
      order: [["ea_id", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      count: examAssessments.length,
      data: examAssessments,
    });
  } catch (error) {
    console.error("Error fetching batch exam assessments:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching batch exam assessments",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get assessment by ID
exports.getExamAssessmentById = async (req, res) => {
  try {
    const examAssessment = await ExamAssessment.findByPk(req.params.id, {
      include: [
        { model: TrainingBatch, as: "training_batches" },
        { model: Center, as: "centers" },
        { model: Course, as: "courses" },
      ],
    });

    if (!examAssessment) {
      return res.status(404).json({
        success: false,
        message: "Exam Assessment not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: examAssessment,
    });
  } catch (error) {
    console.error("Error fetching exam assessment by ID:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching exam assessment",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update exam assessment
exports.updateExamAssessment = async (req, res) => {
  try {
    // Calculate total score if individual components are provided
    let updateData = { ...req.body };
    if (
      req.body.class_participation !== undefined ||
      req.body.final_task !== undefined ||
      req.body.presentation !== undefined ||
      req.body.viva !== undefined
    ) {
      // Get current assessment data to merge with updates
      const currentAssessment = await ExamAssessment.findByPk(req.params.id);
      if (!currentAssessment) {
        return res.status(404).json({
          success: false,
          message: "Exam Assessment not found",
        });
      }

      const class_participation =
        req.body.class_participation !== undefined
          ? req.body.class_participation
          : currentAssessment.class_participation;

      const final_task =
        req.body.final_task !== undefined
          ? req.body.final_task
          : currentAssessment.final_task;

      const presentation =
        req.body.presentation !== undefined
          ? req.body.presentation
          : currentAssessment.presentation;

      const viva =
        req.body.viva !== undefined ? req.body.viva : currentAssessment.viva;

      const total_score =
        parseFloat(class_participation) +
        parseFloat(final_task) +
        parseFloat(presentation) +
        parseFloat(viva);

      updateData = {
        ...updateData,
        total_score: total_score.toFixed(1),
      };
    }

    const [updated] = await ExamAssessment.update(updateData, {
      where: { ea_id: req.params.id },
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Exam Assessment not found or no changes made",
      });
    }

    const updatedExamAssessment = await ExamAssessment.findByPk(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Exam assessment updated successfully",
      data: updatedExamAssessment,
    });
  } catch (error) {
    console.error("Error updating exam assessment:", error);
    return res.status(500).json({
      success: false,
      message: "Server error updating exam assessment",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Delete exam assessment
exports.deleteExamAssessment = async (req, res) => {
  try {
    const deleted = await ExamAssessment.destroy({
      where: { ea_id: req.params.id },
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Exam Assessment not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Exam assessment deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting exam assessment:", error);
    return res.status(500).json({
      success: false,
      message: "Server error deleting exam assessment",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
