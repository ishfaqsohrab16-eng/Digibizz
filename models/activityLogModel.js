const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Center = require("./center");
const Course = require("./course");
const TrainingBatch = require("./trainingBatcheModel");

const ActivityLogModel = sequelize.define(
  "ActivityLog",
  {
    act_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 50],
      },
    },
    user_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
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
    tb_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: TrainingBatch,
        key: "tb_id",
      },
    },
    act_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    act_descrip: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255],
      },
    },
    act_content: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255],
      },
    },
  },
  {
    tableName: "activity_log",
    timestamps: true,
    updatedAt: false,
    createdAt: "act_on",
  }
);

// Associations
ActivityLogModel.belongsTo(Center, { foreignKey: "center_id", as: "center" });
ActivityLogModel.belongsTo(Course, { foreignKey: "course_id", as: "course" });
ActivityLogModel.belongsTo(TrainingBatch, {
  foreignKey: "tb_id",
  as: "trainingBatch",
});

module.exports = ActivityLogModel;
