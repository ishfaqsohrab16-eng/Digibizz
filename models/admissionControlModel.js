const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const TrainingBatch = require("./trainingBatcheModel");
const Center = require("./center");
const Course = require("./course");

const AdmissionControl = sequelize.define(
  "AdmissionControl",
  {
    ac_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
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
    allowed_gender: {
      type: DataTypes.ENUM("all", "male", "female"),
      allowNull: false,
      defaultValue: "all",
    },
  },
  {
    tableName: "admission_controls",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["tb_id", "center_id", "course_id"],
      },
    ],
  }
);

AdmissionControl.belongsTo(TrainingBatch, {
  foreignKey: "tb_id",
  as: "batch",
});
AdmissionControl.belongsTo(Center, {
  foreignKey: "center_id",
  as: "center",
});
AdmissionControl.belongsTo(Course, {
  foreignKey: "course_id",
  as: "course",
});

module.exports = AdmissionControl;
