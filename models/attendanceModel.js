const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Student = require("./studentModel");
const Course = require("./course");
const Center = require("./center");
const TrainingBatch = require("./trainingBatcheModel");

const AttendanceModel = sequelize.define(
  "Attendance",
  {
    attend_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    std_cnic: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    attend_status: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "A",
      validate: {
        isIn: [["P", "A", "L"]], // Present, Absent, Late
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
    attend_date: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
  },
  {
    tableName: "attendance",
    timestamps: false,
  }
);

// Associations

AttendanceModel.belongsTo(Course, { foreignKey: "course_id" });
AttendanceModel.belongsTo(Center, { foreignKey: "center_id" });
AttendanceModel.belongsTo(TrainingBatch, { foreignKey: "tb_id" });

module.exports = AttendanceModel;
