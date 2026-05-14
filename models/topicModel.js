const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const CourseModule = require("./courseModuleModel");
const TrainerTopicReport = require("./trainerTopicReportModel"); // Add this import

const Topic = sequelize.define(
  "topic",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    module_id: {
      type: DataTypes.INTEGER, 
      allowNull: false,
      onDelete: "CASCADE",
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
   
    order_index: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
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
    tableName: "topics",
    timestamps: false,
  }
);

module.exports = Topic;
