const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Center = require("./center");
const Course = require("./course");
const TrainingBatch = require("./trainingBatcheModel");
const Trainer = require("./trainersModel");

const DailyLectureReport = sequelize.define(
  "DailyLectureReport",
  {
    dlr_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    t_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Trainer,
        key: "t_id",
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
    tb_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: TrainingBatch,
        key: "tb_id",
      },
    },
    dlr_date: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    dlr_title: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    dlr_topics: {
      type: DataTypes.TEXT("medium"),
      allowNull: false,
    },
    dlr_practical: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    dlr_assignment: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    dlr_challenges: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    dlr_month: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
  },
  {
    tableName: "daily_lecture_reports",
    timestamps: false,
  }
);

// Associations
DailyLectureReport.belongsTo(Trainer, { foreignKey: "t_id", as: "trainers" });
DailyLectureReport.belongsTo(Center, {
  foreignKey: "center_id",
  as: "centers",
});
DailyLectureReport.belongsTo(Course, {
  foreignKey: "course_id",
  as: "courses",
});
DailyLectureReport.belongsTo(TrainingBatch, {
  foreignKey: "tb_id",
  as: "training_batches",
});

module.exports = DailyLectureReport;
