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
      allowNull: true,
      references: {
        model: Course,
        key: "course_id",
      },
    },
    center_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Center,
        key: "center_id",
      },
    },
    tb_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
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
    /**
     * Audit detail, written by utils/auditHooks.js.
     *
     * act_summary is the paragraph a reader actually sees - who changed what,
     * on which record, from which value to which. act_changes keeps the same
     * information field by field as JSON, so the history can be queried and
     * diffed rather than only read.
     */
    act_actor_name: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    act_entity: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    act_entity_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    act_summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    act_changes: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },
    act_ip: {
      type: DataTypes.STRING(45),
      allowNull: true,
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
