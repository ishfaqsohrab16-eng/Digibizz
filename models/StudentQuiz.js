const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Teacher = require("./trainersModel");
const TrainingBatch = require("./trainingBatcheModel");

const StudentQuiz = sequelize.define(
  "StudentQuiz",
  {
    quiz_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    quiz_code: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    quiz_title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255],
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
    t_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Teacher,
        key: "t_id",
      },
    },
    quiz_tab_change: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "ON",
      validate: {
        isIn: [["ON", "OFF"]],
      },
    },
    quiz_passing_score: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0,
        max: 100,
      },
    },
    quiz_time_limit: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
      validate: {
        min: 1,
      },
    },
    quiz_attempts_limit: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2,
      validate: {
        min: 1,
      },
    },
    quiz_result_answers: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "ON",
      validate: {
        isIn: [["ON", "OFF"]],
      },
    },
    quiz_created_on: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
  },
  {
    tableName: "student_quiz",
    timestamps: false,
  }
);

StudentQuiz.belongsTo(Teacher, {
  foreignKey: "t_id",
  as: "trainers",
});
StudentQuiz.belongsTo(TrainingBatch, {
  foreignKey: "tb_id",
  as: "training_batches",
});
module.exports = StudentQuiz;
