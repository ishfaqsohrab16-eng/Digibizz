const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Trainer = require("./trainersModel");
const TrainingBatch = require("./trainingBatcheModel");
const Center = require("./center");
const Course = require("./course");
const LectureRecording = sequelize.define(
  "LectureRecording",
  {
    lr_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    lr_title: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    lr_topics: {
      type: DataTypes.TEXT("medium"),
      allowNull: false,
    },
    lr_link: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    lr_attachment: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    lr_date: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    t_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    tb_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    center_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    lr_added_on: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
  },
  {
    tableName: "lecture_recordings",
    timestamps: false,
  }
);

// Define associations

  LectureRecording.belongsTo(Trainer, { foreignKey: "t_id", as: "trainers" });
  LectureRecording.belongsTo(TrainingBatch, { foreignKey: "tb_id", as: "training_batches" });
  LectureRecording.belongsTo(Center, { foreignKey: "center_id", as: "centers" });
  LectureRecording.belongsTo(Course, { foreignKey: "course_id", as: "courses" });
module.exports = LectureRecording;
