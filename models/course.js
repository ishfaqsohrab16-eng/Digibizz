const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const CourseModel = sequelize.define(
  "Course",
  {
    course_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    course_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    course_full_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    course_status: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      validate: {
        isIn: [[0, 1]],
      },
    },
  },
  {
    tableName: "courses",
    timestamps: true,
  }
);

module.exports = CourseModel;
