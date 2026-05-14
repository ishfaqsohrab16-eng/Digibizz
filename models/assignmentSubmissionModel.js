const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Student = require("./studentModel");
const Center = require("./center");
const Course = require("./course");
const TrainingBatch = require("./trainingBatcheModel");
const Assignment = require("./assignmentModel");

const AssignmentSubmissionModel = sequelize.define(
  "AssignmentSubmission",
  {
    as_submission_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    std_rollno: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    tb_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: TrainingBatch,
        key: "tb_id",
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
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Course,
        key: "course_id",
      },
    },
    as_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Assignment,
        key: "as_id",
      },
    },
    submitted_on: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    as_submission_comment: {
      type: DataTypes.TEXT("medium"),
      allowNull: true,
    },
    as_submission_attachment: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    trainer_comments: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },
    obt_marks: {
      type: DataTypes.STRING(5),
      allowNull: true,
    },
    as_submission_status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "assignment_submissions",
    timestamps: false,
  }
);

// Associations
AssignmentSubmissionModel.belongsTo(Assignment, { foreignKey: "as_id" });
AssignmentSubmissionModel.belongsTo(TrainingBatch, { foreignKey: "tb_id" });
AssignmentSubmissionModel.belongsTo(Center, { foreignKey: "center_id" });
AssignmentSubmissionModel.belongsTo(Course, { foreignKey: "course_id" });

module.exports = AssignmentSubmissionModel;
