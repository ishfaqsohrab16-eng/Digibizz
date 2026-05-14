const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db.js");
const Center = require("./center.js");
const TrainingBatch = require("./trainingBatcheModel.js");
const Trainer = require("./trainersModel.js");
const Course = require("./course.js");

const TrainerAttendanceModel = sequelize.define(
  "TrainerAttendance",
  {
    ta_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    cu_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Course,
        key: "course_id",
      },
    },
    t_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Trainer,
        key: "t_id",
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
    center_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Center,
        key: "center_id",
      },
    },
    ta_date: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    checkin_time: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    checkout_time: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
  },
  {
    tableName: "trainer_attendance",
    timestamps: false,
  }
);

// Associations
TrainerAttendanceModel.belongsTo(TrainingBatch, { foreignKey: "tb_id" });
TrainerAttendanceModel.belongsTo(Center, { foreignKey: "center_id" });
TrainerAttendanceModel.belongsTo(Trainer, { foreignKey: "t_id" });
TrainerAttendanceModel.belongsTo(Course, { foreignKey: "cu_id" });

module.exports = TrainerAttendanceModel;
