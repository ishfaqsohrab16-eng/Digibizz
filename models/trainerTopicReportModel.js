const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const TrainerTopicReport = sequelize.define(
  "trainer_topic_report",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    trainer_id: {
      type: DataTypes.INTEGER, 
      allowNull: false,
    },
    tb_id: {
      type: DataTypes.INTEGER, 
      allowNull: false,
    },
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    center_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    module_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    topic_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    reported_date: {
      type: DataTypes.DATEONLY,
      defaultValue: DataTypes.NOW,
    },
    mark_done: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "trainer_topic_reports",
    timestamps: false,
  }
);

module.exports = TrainerTopicReport;

// Associations
// TrainerTopicReport.belongsTo(Trainer, { foreignKey: "trainer_id", as: "trainer" }); // fix foreignKey name
// TrainerTopicReport.belongsTo(Course, { foreignKey: "course_id", as: "course" });
// TrainerTopicReport.belongsTo(CourseModule, { foreignKey: "module_id", as: "module" });
// TrainerTopicReport.belongsTo(Topic, { foreignKey: "topic_id", as: "topic" });
