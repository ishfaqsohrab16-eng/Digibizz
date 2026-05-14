const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const StudentQuiz = require("./StudentQuiz");

const StudentQuizQuestions = sequelize.define(
  "StudentQuizQuestions",
  {
    q_id: {
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
    q_title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255],
      },
    },
    a1: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255],
      },
    },
    a2: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255],
      },
    },
    a3: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255],
      },
    },
    a4: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255],
      },
    },
    correct_a: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255],
      },
    },
    correct_a_reason: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
    },
  },
  {
    tableName: "student_quiz_questions",
    timestamps: false,
  }
);
StudentQuizQuestions.belongsTo(StudentQuiz, {
  foreignKey: "quiz_code",
  as: "student_quiz",
});
module.exports = StudentQuizQuestions;
