const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const StudentQuiz = require("./StudentQuiz");
const Student = require("./studentModel");
const TrainingBatch = require("./trainingBatcheModel");
const Course = require("./course");
const Center = require("./center");

const StudentQuizAttempts = sequelize.define(
  "StudentQuizAttempts",
  {
    attempt_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    attempt_session: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    quiz_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      references: {
        model: StudentQuiz,
        key: "quiz_code",
      },
      validate: {
        notEmpty: true,
        len: [1, 20],
      },
    },
    std_cnic: {
      type: DataTypes.STRING(100),
      allowNull: false,
      references: {
        model: Student,
        key: "std_cnic",
      },
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    tb_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: TrainingBatch,
        key: "tb_id",
      },
    },
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Course,
        key: "course_id",
      },
    },
    center_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Center,
        key: "center_id",
      },
    },
    marks_obt: {
      type: DataTypes.DECIMAL(10, 0),
      allowNull: false,
    },
    attempt_date: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    attempt_start_time: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    attempt_end_time: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    attempt_status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "student_quiz_attempts",
    timestamps: false,
  }
);

// Associations
StudentQuizAttempts.belongsTo(StudentQuiz, {
  foreignKey: "quiz_code",
  as: "student_quiz",
});
StudentQuizAttempts.belongsTo(Student, {
  foreignKey: "std_cnic",
  as: "students",
});
StudentQuizAttempts.belongsTo(TrainingBatch, {
  foreignKey: "tb_id",
  as: "training_batches",
});
StudentQuizAttempts.belongsTo(Course, {
  foreignKey: "course_id",
  as: "courses",
});
StudentQuizAttempts.belongsTo(Center, {
  foreignKey: "center_id",
  as: "centers",
});

module.exports = StudentQuizAttempts;
