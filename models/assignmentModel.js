const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Course = require("./course");
const Center = require("./center");
const TrainingBatch = require("./trainingBatcheModel");
const Trainer = require("./trainersModel");

const AssignmentModel = sequelize.define(
  "Assignment",
  {
    as_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    as_title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    as_description: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
    },
    /**
     * Ties together the copies created for each of a trainer's classes.
     *
     * One assignment set for three centres is three rows, because students
     * are listed per class and submissions hang off a single row. Without a
     * shared key, editing the title changed it for one centre and left the
     * other two showing the old one, and deleting removed one of three.
     *
     * Nullable: rows written before this column existed have no group, and
     * are edited and deleted individually, exactly as they were.
     */
    as_group_id: {
      type: DataTypes.STRING(36),
      allowNull: true,
    },
    as_attachment: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    as_deadline: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    as_marks: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    t_id: {
      type: DataTypes.INTEGER,
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
    as_added_on: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "assignments",
    timestamps: false,
  }
);

// Associations
AssignmentModel.belongsTo(Course, { foreignKey: "course_id" });
AssignmentModel.belongsTo(Center, { foreignKey: "center_id" });
AssignmentModel.belongsTo(TrainingBatch, { foreignKey: "tb_id" });
AssignmentModel.belongsTo(Trainer, { foreignKey: "t_id" });

module.exports = AssignmentModel;
