const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");
const { sequelize } = require("../config/db");
const Center = require("./center");
const Course = require("./course");
const User = require("./userModel");
const TrainingBatch = require("./trainingBatcheModel");
const TrainerModel = require("./trainersModel");

const StudentModel = sequelize.define(
  "student",
  {
    std_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 6,
      references: {
        model: User,
        key: "user_id",
      },
    },
    std_rollno: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "",
    },
    std_cnic: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
      },
    },
    std_fathername: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    std_gender: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: [["Male", "Female", "Other"]],
      },
    },
    std_qualification: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    std_district: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    std_phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    tb_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 6,
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
    dark_mode: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        isIn: [[0, 1]],
      },
    },
    std_added_on: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    std_lms_status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    std_forum_status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    suspension_reason: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "",
    },
    special_case: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 1,
      validate: {
        isIn: [[0, 1]],
      },
    },
    special_case_comments: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "",
    },
  },
  {
    tableName: "students",
    timestamps: true,
  }
);

// Associations
StudentModel.belongsTo(User, { foreignKey: "user_id", as: "user" });
StudentModel.belongsTo(Center, { foreignKey: "center_id", as: "centers" });
StudentModel.belongsTo(Course, { foreignKey: "course_id", as: "courses" });
StudentModel.belongsTo(TrainingBatch, {
  foreignKey: "tb_id",
  as: "training_batches",
});

Center.hasOne(StudentModel, { foreignKey: "center_id", as: "students" });
Course.hasOne(StudentModel, { foreignKey: "course_id", as: "students" });

module.exports = StudentModel;
