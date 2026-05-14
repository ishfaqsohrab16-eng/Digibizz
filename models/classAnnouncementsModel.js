const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Trainer = require("./trainersModel");
const TrainingBatch = require("./trainingBatcheModel");
const Course = require("./course");
const Center = require("./center");

const ClassAnnouncements = sequelize.define(
  "ClassAnnouncements",
  {
    ca_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    ca_title: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    ca_message: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
      validate: {
        notEmpty: true,
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
    ca_added_on: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
  },
  {
    tableName: "class_announcements",
    timestamps: false,
  }
);

// Define associations
ClassAnnouncements.belongsTo(Trainer, { foreignKey: "t_id", as: "trainer" });
ClassAnnouncements.belongsTo(TrainingBatch, {
  foreignKey: "tb_id",
  as: "training_batch",
});
ClassAnnouncements.belongsTo(Course, { foreignKey: "course_id", as: "course" });
ClassAnnouncements.belongsTo(Center, { foreignKey: "center_id", as: "center" });

module.exports = ClassAnnouncements;
