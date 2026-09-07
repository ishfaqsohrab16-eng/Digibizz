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
      // TEXT, like dlr_topics beside it. This is a free-text account of what
      // went wrong in a lecture, and 255 characters is about three sentences:
      // a trainer describing a room with the fans off and students leaving
      // early for their buses wrote 340 and the whole report was rejected
      // with "Data too long for column 'dlr_challenges'". The report is the
      // only record of that lecture, so losing it to a field width is the
      // worst possible outcome.
      type: DataTypes.TEXT,
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
