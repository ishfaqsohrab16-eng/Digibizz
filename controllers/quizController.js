const StudentQuiz = require("../models/StudentQuiz");
const StudentQuizQuestions = require("../models/StudentQuizQuestions");
const StudentQuizAttempts = require("../models/StudentQuizAttempts");
const StudentQuizAnswers = require("../models/StudentQuizAnswers");
const Teacher = require("../models/trainersModel");
const Student = require("../models/studentModel");
const TrainingBatch = require("../models/trainingBatcheModel");
const Course = require("../models/course");
const Center = require("../models/center");
const TrainerCenterAllocation = require("../models/trainersCenterAllocationModel");
const User = require("../models/userModel");
const { validationResult } = require("express-validator");
const { sequelize } = require("../config/db");
const { Op } = require("sequelize");
const { FORCE } = require("sequelize/lib/index-hints");

// Create Quiz
exports.createQuiz = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const t = await sequelize.transaction();
  const { tb_id, t_id } = req.params;

  try {
    // Fix: Extract the data from the nested structure if it exists
    const requestData = req.body.data || req.body;

    const {
      quiz_title,
      quiz_tab_change,
      quiz_passing_score,
      quiz_time_limit,
      quiz_attempts_limit,
      quiz_result_answers,
      questions,
    } = requestData;

    // Generate unique quiz code
    const quiz_code = "QZ" + Date.now();
    const quiz_created_on = new Date().toISOString().split("T")[0];
    const trainer = await Teacher.findOne({ where: { user_id: t_id } });
    // Create quiz
    if (!trainer) {
      await t.rollback();
      return res
        .status(404)
        .json({ message: "Trainer not found", user_id: t_id });
    }
    const newQuiz = await StudentQuiz.create(
      {
        quiz_code,
        quiz_title,
        tb_id,
        t_id: trainer.t_id,
        quiz_tab_change,
        quiz_passing_score,
        quiz_time_limit,
        quiz_attempts_limit,
        quiz_result_answers,
        quiz_created_on,
      },
      { transaction: t }
    );

    // Create quiz questions
    if (questions && questions.length > 0) {
      const questionsWithQuizCode = questions.map((q) => ({
        ...q,
        quiz_code,
      }));

      await StudentQuizQuestions.bulkCreate(questionsWithQuizCode, {
        transaction: t,
      });
    }

    await t.commit();

    res.status(201).json({
      success: true,
      message: "Quiz created successfully",
      quiz: {
        quiz_id: newQuiz.quiz_id,
        quiz_code: newQuiz.quiz_code,
        quiz_title: newQuiz.quiz_title,
      },
    });
  } catch (error) {
    await t.rollback();
    console.error("Quiz creation error:", error);
    res.status(500).json({ message: "Server error during quiz creation" });
  }
};

// Get Quiz Details
exports.getQuizDetails = async (req, res) => {
  try {
    const { quiz_code } = req.params;

    const quiz = await StudentQuiz.findOne({
      where: { quiz_code },
      include: [
        { model: Teacher, as: "teacher", attributes: ["t_name"] },
        {
          model: StudentQuizQuestions,
          as: "questions",
          attributes: [
            "q_id",
            "q_title",
            "a1",
            "a2",
            "a3",
            "a4",
            "correct_a",
            "correct_a_reason",
          ],
        },
      ],
    });

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    res.json(quiz);
  } catch (error) {
    console.error("Fetch quiz details error:", error);
    res.status(500).json({ message: "Server error fetching quiz details" });
  }
};

// Start Quiz Attempt
exports.startQuizAttempt = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const t = await sequelize.transaction();

  try {
    const { quiz_code, tb_id, user_id } = req.body;
    const student = await Student.findOne({ where: { user_id } });
    // Check if quiz exists
    const quiz = await StudentQuiz.findOne({ where: { quiz_code } });
    if (!quiz) {
      await t.rollback();
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Check if student has reached attempts limit
    const attemptCount = await StudentQuizAttempts.count({
      where: {
        quiz_code,
        std_cnic: student.std_cnic,
      },
    });

    if (attemptCount >= quiz.quiz_attempts_limit) {
      await t.rollback();
      return res
        .status(400)
        .json({ message: "Maximum attempts reached for this quiz" });
    }

    // Generate unique attempt session
    const attempt_session = `${quiz_code}-${student.std_cnic}-${Date.now()}`;
    const current_date = new Date().toISOString().split("T")[0];
    const current_time = new Date().toTimeString().split(" ")[0];

    // Create new attempt
    const newAttempt = await StudentQuizAttempts.create(
      {
        attempt_session,
        quiz_code,
        std_cnic: student.std_cnic,
        tb_id,
        course_id: student.course_id,
        center_id: student.center_id,
        marks_obt: 0,
        attempt_date: current_date,
        attempt_start_time: current_time,
        attempt_end_time: "",
        attempt_status: 0,
      },
      { transaction: t }
    );

    // Get questions for the quiz (without correct answers)
    const questions = await StudentQuizQuestions.findAll({
      where: { quiz_code },
      attributes: ["q_id", "q_title", "a1", "a2", "a3", "a4"],
      order: sequelize.literal("RAND()"),
      transaction: t,
    });

    await t.commit();

    res.status(201).json({
      message: "Quiz attempt started successfully",
      attempt: {
        attempt_session: newAttempt.attempt_session,
        time_limit: quiz.quiz_time_limit,
        tab_change: quiz.quiz_tab_change,
        questions,
      },
    });
  } catch (error) {
    await t.rollback();
    console.error("Start quiz attempt error:", error);
    res.status(500).json({ message: "Server error starting quiz attempt" });
  }
};

// Submit Quiz Answers
exports.submitQuizAnswers = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const t = await sequelize.transaction();

  try {
    const { attempt_session, answers } = req.body;
    const attempt = await StudentQuizAttempts.findOne({
      where: { attempt_session },
      transaction: t,
    });

    if (!attempt) {
      await t.rollback();
      return res.status(404).json({ message: "Attempt not found" });
    }

    if (attempt.attempt_status === 1) {
      await t.rollback();
      return res
        .status(400)
        .json({ message: "This attempt has already been submitted" });
    }

    // Get quiz details
    const quiz = await StudentQuiz.findOne({
      where: { quiz_code: attempt.quiz_code },
      transaction: t,
    });

    // Get all questions for the quiz
    const questions = await StudentQuizQuestions.findAll({
      where: { quiz_code: attempt.quiz_code },
      transaction: t,
    });

    // Save student answers
    const current_time = new Date().toISOString();

    const answerRecords = answers.map((ans) => ({
      quiz_code: attempt.quiz_code,
      attempt_session,
      q_id: ans.q_id,
      student_answer: ans.answer,
      sqa_added_on: current_time,
    }));

    await StudentQuizAnswers.bulkCreate(answerRecords, { transaction: t });

    // Calculate score
    let correctAnswers = 0;
    for (const ans of answers) {
      const question = questions.find(
        (q) => q.q_id.toString() === ans.q_id.toString()
      );
      if (question && question.correct_a === ans.answer) {
        correctAnswers++;
      }
    }

    const totalQuestions = questions.length;
    const scorePercentage = (correctAnswers / totalQuestions) * 100;

    // Update attempt
    await StudentQuizAttempts.update(
      {
        marks_obt: scorePercentage,
        attempt_end_time: new Date().toTimeString().split(" ")[0],
        attempt_status: 1,
      },
      {
        where: { attempt_session },
        transaction: t,
      }
    );

    await t.commit();

    // Prepare result
    const passed = scorePercentage >= quiz.quiz_passing_score;

    // Only include correct answers if quiz settings allow it
    let resultDetails = {
      score: scorePercentage.toFixed(2),
      passed,
      total_questions: totalQuestions,
      correct_answers: correctAnswers,
    };

    if (quiz.quiz_result_answers === "ON") {
      resultDetails.answers = questions.map((q) => ({
        q_id: q.q_id,
        q_title: q.q_title,
        correct_answer: q.correct_a,
        correct_reason: q.correct_a_reason,
      }));
    }

    res.json({
      message: "Quiz submitted successfully",
      result: resultDetails,
    });
  } catch (error) {
    await t.rollback();
    console.error("Submit quiz answers error:", error);
    res.status(500).json({ message: "Server error submitting quiz answers" });
  }
};

// Get Student Quiz Results
exports.getStudentQuizResults = async (req, res) => {
  try {
    const { std_cnic } = req.params;

    const results = await StudentQuizAttempts.findAll({
      where: {
        std_cnic,
        attempt_status: 1,
      },
      include: [
        {
          model: StudentQuiz,
          as: "quiz",
          attributes: ["quiz_title", "quiz_passing_score"],
        },
        {
          model: Course,
          as: "course",
          attributes: ["course_name"],
        },
        {
          model: TrainingBatch,
          as: "trainingBatch",
          attributes: ["tb_name"],
        },
      ],
      order: [
        ["attempt_date", "DESC"],
        ["attempt_start_time", "DESC"],
      ],
    });

    res.json(results);
  } catch (error) {
    console.error("Fetch student quiz results error:", error);
    res.status(500).json({ message: "Server error fetching quiz results" });
  }
};

// Get Teacher's Quizzes
exports.getTeacherQuizzes = async (req, res) => {
  try {
    const { user_id, tb_id } = req.params;

    // First find the trainer
    const trainer = await Teacher.findOne({
      where: { user_id: user_id },
    });

    if (!trainer) {
      return res.status(404).json({ message: "Trainer not found" });
    }

    // Get quizzes with a subquery for question count
    const quizzes = await StudentQuiz.findAll({
      where: {
        t_id: trainer.t_id,
        tb_id,
      },
      attributes: [
        "quiz_id",
        "quiz_code",
        "quiz_title",
        "quiz_passing_score",
        "quiz_time_limit",
        "quiz_attempts_limit",
        "quiz_created_on",
        [
          sequelize.literal(`(
            SELECT COUNT(*)
            FROM student_quiz_questions
            WHERE student_quiz_questions.quiz_code = StudentQuiz.quiz_code
          )`),
          "question_count",
        ],
      ],
      order: [["quiz_created_on", "DESC"]],
    });
    const studentQuizQuestions = await StudentQuizQuestions.findAll({
      where: {
        quiz_code: {
          [Op.in]: quizzes.map((quiz) => quiz.quiz_code),
        },
      },
    });
    // Format the response
    const formattedQuizzes = quizzes.map((quiz) => ({
      ...quiz.toJSON(),
      questionCount: parseInt(quiz.getDataValue("question_count")) || 0,
      studentQuizQuestions: studentQuizQuestions.filter(
        (question) => question.quiz_code === quiz.quiz_code
      ),
    }));
  
    res.json(formattedQuizzes);
  } catch (error) {
    console.error("Fetch teacher quizzes error:", error);
    res.status(500).json({
      message: "Server error fetching teacher quizzes",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.getStudentQuizzes = async (req, res) => {
  try {
    const { user_id, tb_id } = req.params;

    const student = await Student.findOne({
      where: { user_id: user_id },
    });
    const trainerCenterAllocations = await TrainerCenterAllocation.findOne({
      where: {
        course_id: student.course_id,
        center_id: student.center_id,
        tb_id: student.tb_id,
      },
    });
    if (!trainerCenterAllocations) {
      return res.status(404).json({ message: "Trainer not found" });
    }

    // Get quizzes with question count
    const quizzes = await StudentQuiz.findAll({
      where: {
        t_id: trainerCenterAllocations.t_id,
        tb_id,
      },
    });

    // Extract quiz codes from the quizzes array
    const quizCodes = quizzes.map((quiz) => quiz.quiz_code);

    // Get questions for all quizzes
    const questions = await StudentQuizQuestions.findAll({
      where: {
        quiz_code: {
          [Op.in]: quizCodes,
        },
      },
    });

    // Replace the count query with findAll
    const attempts = await StudentQuizAttempts.findAll({
      where: {
        std_cnic: student.std_cnic,
        tb_id,
        quiz_code: {
          [Op.in]: quizCodes,
        },
      },
      attributes: [
        "quiz_code",
        "attempt_session",
        "attempt_status",
        "marks_obt",
      ],
    });

    // Format the response to include attempts data
    const quizzesWithAttempts = quizzes.map((quiz) => ({
      ...quiz.toJSON(),
      attempts: attempts.filter(
        (attempt) => attempt.quiz_code === quiz.quiz_code
      ).length,
      lastAttempt: attempts.find(
        (attempt) => attempt.quiz_code === quiz.quiz_code
      ),
    }));

    res.json({
      quizzes: quizzesWithAttempts,
      questions,
      attempts,
    });
  } catch (error) {
    console.error("Fetch student quizzes error:", error);
    res.status(500).json({
      message: "Server error fetching student quizzes",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update Quiz
exports.updateQuiz = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { quiz_code } = req.params;
    const requestData = req.body.data || req.body;
    const {
      quiz_title,
      quiz_tab_change,
      quiz_passing_score,
      quiz_time_limit,
      quiz_attempts_limit,
      quiz_result_answers,
      questions,
    } = requestData;

    // Check if quiz exists
    const quiz = await StudentQuiz.findOne({
      where: { quiz_code },
      transaction: t,
    });

    if (!quiz) {
      await t.rollback();
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Update quiz details
    await StudentQuiz.update(
      {
        quiz_title,
        quiz_tab_change,
        quiz_passing_score,
        quiz_time_limit,
        quiz_attempts_limit,
        quiz_result_answers,
      },
      {
        where: { quiz_code },
        transaction: t,
      }
    );

    // Update questions if provided
    if (questions && questions.length > 0) {
      // Delete existing questions
      await StudentQuizQuestions.destroy({
        where: { quiz_code },
        transaction: t,
      });

      // Create new questions
      const questionsWithQuizCode = questions.map((q) => ({
        ...q,
        quiz_code,
      }));

      await StudentQuizQuestions.bulkCreate(questionsWithQuizCode, {
        transaction: t,
      });
    }

    await t.commit();
    res.status(200).json({
      success: true,
      message: "Quiz updated successfully",
    });
  } catch (error) {
    await t.rollback();
    console.error("Quiz update error:", error);
    res.status(500).json({ message: "Server error during quiz update" });
  }
};

// Delete Quiz
exports.deleteQuiz = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { quiz_code } = req.params;

    // Check if quiz exists
    const quiz = await StudentQuiz.findOne({
      where: { quiz_code },
      transaction: t,
    });

    if (!quiz) {
      await t.rollback();
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Check if quiz has any attempts and delete them
    await StudentQuizAnswers.destroy({
      where: { quiz_code },
      transaction: t,
    });

    await StudentQuizAttempts.destroy({
      where: { quiz_code },
      transaction: t,
    });

    // Delete questions
    await StudentQuizQuestions.destroy({
      where: { quiz_code },
      transaction: t,
    });

    // Delete the quiz
    await StudentQuiz.destroy({
      where: { quiz_code },
      transaction: t,
    });

    await t.commit();
    res.status(200).json({
      success: true,
      message: "Quiz deleted successfully",
    });
  } catch (error) {
    await t.rollback();
    console.error("Quiz deletion error:", error);
    res.status(500).json({ message: "Server error during quiz deletion" });
  }
};

// Get Student Quiz Result List
exports.getStudentQuizResultList = async (req, res) => {
  try {
    const { quiz_code } = req.params;

    // Check if quiz exists
    const quiz = await StudentQuiz.findOne({
      where: { quiz_code },
      attributes: ["quiz_title", "quiz_passing_score"], // Include passing score
    });

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    // Fetch all attempts for the quiz
    const attempts = await StudentQuizAttempts.findAll({
      where: { quiz_code },
      order: [["marks_obt", "DESC"]],
    });

    // Format the response
    const resultList = await Promise.all(
      attempts.map(async (attempt) => {
        const student = await Student.findOne({
          where: { std_cnic: attempt.std_cnic },
          include: [
            {
              model: User,
              as: "user",
              attributes: ["user_name", "user_email"],
            },
          ],
        });

        if (!student) return null;

        return {
          student: {
            cnic: student.std_cnic,
            name: student.user.user_name,
            email: student.user.user_email,
          },
          marks_obtained: attempt.marks_obt,
          status: attempt.marks_obt >= quiz.quiz_passing_score ? "PASS" : "FAIL", // Calculate status
          attempt_date: attempt.attempt_date,
          start_time: attempt.attempt_start_time,
          end_time: attempt.attempt_end_time,
        };
      })
    ).then((results) => results.filter((result) => result !== null)); // Filter out null results

    res.json({
      quiz_title: quiz.quiz_title,
      quiz_passing_score: quiz.quiz_passing_score, // Include passing score in response
      total_attempts: resultList.length,
      results: resultList,
    });
  } catch (error) {
    console.error("Fetch student quiz result list error:", error);
    res.status(500).json({ message: "Server error fetching quiz result list" });
  }
};
