const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const TrainingBatch = require("./trainingBatcheModel");
const Center = require("./center");
const Course = require("./course");

const studentLeaveModel = sequelize.define(
  "studentLeave",
  {
    sl_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    sl_code: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    std_cnic: {
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

    sl_date: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    sl_month: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    sl_subject: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    sl_body: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
    },
    sl_trainer_comments: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    sl_status: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    sl_submit_date: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
  },
  {
    tableName: "students_leaves",
    timestamps: false,
  }
);

studentLeaveModel.belongsTo(TrainingBatch, {
  foreignKey: "tb_id",
  as: "training_batches",
});
studentLeaveModel.belongsTo(Center, { foreignKey: "center_id", as: "centers" });
studentLeaveModel.belongsTo(Course, { foreignKey: "course_id", as: "courses" });

module.exports = studentLeaveModel;
