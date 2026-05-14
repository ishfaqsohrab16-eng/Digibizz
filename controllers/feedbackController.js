const StudentsFeedback = require("../models/studentsFeedbackModel");
const Student = require("../models/studentModel");
const TrainerCenterAllocation = require("../models/trainersCenterAllocationModel");
const Trainer = require("../models/trainersModel");
const MastterTrainer = require("../models/masterTrainersModel");
const User = require("../models/userModel");
const Course = require("../models/course");
const Center = require("../models/center");
const getAllFeedback = async (req, res) => {
  try {
    const feedbacks = await StudentsFeedback.findAll();
    res.json(feedbacks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createFeedback = async (req, res) => {
  try {
    const {
      user_id,
      sf_lecture,
      sf_queries,
      sf_knowledge,
      sf_punctuality,
      sf_trainer_feedback,
      sf_lab_clean,
      sf_lab_internet,
      sf_lab_feedback,
      sf_date,
      sf_month,
    } = req.body;
    const student = await Student.findOne({
      where: { user_id: user_id },
    });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }
    const trainer = await TrainerCenterAllocation.findOne({
      where: { center_id: student.center_id, course_id: student.course_id },
    });
    if (!trainer) {
      return res.status(404).json({ message: "Trainer not found" });
    }
    const newFeedback = await StudentsFeedback.create({
      std_rollno: student.std_rollno,
      tb_id: student.tb_id,
      center_id: student.center_id,
      t_id: trainer.t_id,
      course_id: student.course_id,
      sf_lecture,
      sf_queries,
      sf_knowledge,
      sf_punctuality,
      sf_trainer_feedback,
      sf_lab_clean,
      sf_lab_internet,
      sf_lab_feedback,
      sf_date,
      sf_month,
    });
    res.status(201).json(newFeedback);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateFeedback = async (req, res) => {
  const { id } = req.params;
  try {
    const [updated] = await StudentsFeedback.update(req.body, {
      where: { sf_id: id },
    });
    if (updated) {
      const updatedFeedback = await StudentsFeedback.findByPk(id);
      res.json(updatedFeedback);
    } else {
      res.status(404).json({ message: "Feedback not found" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteFeedback = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await StudentsFeedback.destroy({
      where: { sf_id: id },
    });
    if (deleted) {
      res.json({ message: "Feedback deleted" });
    } else {
      res.status(404).json({ message: "Feedback not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getFeedbackByTbId = async (req, res) => {
  const { tb_id } = req.params;
  try {
    const feedbacks = await StudentsFeedback.findAll({
      where: { tb_id },
    });
    if (feedbacks.length === 0) {
      return res.status(404).json({ message: "No feedback found" });
    }
    res.json(feedbacks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getAllFeedBacks = async (req, res) => {
  const { user_id, tb_id, userType } = req.params;
  try {
    let condition = {
      tb_id: tb_id,
    };
    if (userType === "MasterTrainer") {
      const masterTrainer = await MastterTrainer.findOne({
        where: { user_id: user_id },
        attributes: ["mt_course_id"], // Explicitly select course_id
      });

      if (!masterTrainer) {
        return res.status(404).json({
          success: false,
          message: "Trainer not found",
        });
      }

      if (!masterTrainer.mt_course_id) {
        return res.status(400).json({
          success: false,
          message: "Course ID not assigned to trainer",
        });
      }

      condition = {
        tb_id: tb_id,
        course_id: masterTrainer.mt_course_id,
      };
    }
    const feedbacks = await StudentsFeedback.findAll({
      where: condition,
      raw: true,
    });

    const feedbacksWithStudentInfo = await Promise.all(
      feedbacks.map(async (feedback) => {
        const student = await Student.findOne({
          where: { std_rollno: feedback.std_rollno },
          include: [
            {
              model: User,
              as: "user",
              attributes: ["user_name", "user_profile_photo"],
            },
            {
              model: Course,
              as: "courses",
              attributes: ["course_name"],
            },
            {
              model: Center,
              as: "centers",
              attributes: ["center_name"],
            },
          ],
          raw: true,
          nest: true,
        });

        if (!student) {
          return {
            ...feedback,
            studentName: "Unknown",
            studentImage: null,
            centerName: null,
            courseName: null,
          };
        }

        return {
          ...feedback,
          studentName: student.user?.user_name || "Unknown",
          studentImage: student.user?.user_profile_photo || null,
          centerName: student.centers?.center_name || null,
          courseName: student.courses?.course_name || null,
        };
      })
    );

    // Filter out feedbacks with the specified conditions
    const filteredFeedbacks = feedbacksWithStudentInfo.filter(
      (feedback) =>
        feedback.studentName !== "Unknown" &&
        feedback.studentImage !== null &&
        feedback.centerName !== null &&
        feedback.courseName !== null
    );

    res.json({
      success: true,
      data: filteredFeedbacks,
    });
  } catch (error) {
    console.error("Feedback Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
      error: process.env.NODE_ENV === "development" ? error : undefined,
    });
  }
};
const getFeedbackByTbIdCenterIdCourseId = async (req, res) => {
  const { tb_id, center_id, course_id } = req.params;
  try {
    const feedbacks = await StudentsFeedback.findAll({
      where: { tb_id, center_id, course_id },
    });
    if (feedbacks.length === 0) {
      return res.status(404).json({ message: "No feedback found" });
    }
    res.json(feedbacks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const getFeedbackForTrainer = async (req, res) => {
  const { tb_id, user_id } = req.params;
  try {
    const trainer = await Trainer.findOne({
      where: { user_id: user_id },
    });
    const feedbacks = await StudentsFeedback.findAll({
      where: { tb_id, t_id: trainer.t_id },
    });
    if (feedbacks.length === 0) {
      return res.status(404).json({ message: "No feedback found" });
    }
    res.json(feedbacks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
module.exports = {
  getAllFeedback,
  createFeedback,
  updateFeedback,
  deleteFeedback,
  getFeedbackByTbId,
  getFeedbackByTbIdCenterIdCourseId,
  getFeedbackForTrainer,
  getAllFeedBacks,
};
