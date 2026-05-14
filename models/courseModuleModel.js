const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Course = require("./course");
const User = require("./userModel");
const Topic = require("./topicModel");
const CourseModule = sequelize.define(
  "module",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Course,
        key: "course_id", // change from "id" to "course_id"
      },
      onDelete: "CASCADE",
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    order_index: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    created_by: {
      type: DataTypes.INTEGER, // changed from UUID to INTEGER
      allowNull: true,
      references: {
        model: User,
        key: "user_id",
      },
    },
    module_image: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "modules",
    timestamps: false,
  }
);
module.exports = CourseModule;
