const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const StudentQuiz = require("./StudentQuiz");
const StudentQuizAttempts = require("./StudentQuizAttempts");
const StudentQuizQuestions = require("./StudentQuizQuestions");

const StudentQuizAnswers = sequelize.define(
  "StudentQuizAnswers",
  {
    sqa_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    quiz_code: {
      type: DataTypes.STRING(100),
      allowNull: false,
      references: {
        model: StudentQuiz,
        key: "quiz_code",
      },
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    attempt_session: {
      type: DataTypes.STRING(100),
      allowNull: false,
      references: {
        model: StudentQuizAttempts,
        key: "attempt_session",
      },
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    q_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 50],
      },
    },
    student_answer: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255],
      },
    },
    sqa_added_on: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
  },
  {
    tableName: "student_quiz_answers",
    timestamps: false,
  }
);

// Associations
StudentQuizAnswers.belongsTo(StudentQuiz, {
  foreignKey: "quiz_code",
  as: "student_quiz",
});
StudentQuizAnswers.belongsTo(StudentQuizAttempts, {
  foreignKey: "attempt_session",
  as: "student_quiz_attempts",
});

module.exports = StudentQuizAnswers;
