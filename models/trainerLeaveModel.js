const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const TrainingBatch = require("./trainingBatcheModel");
const Center = require("./center");
const Course = require("./course");
const Trainer = require("./trainersModel");

const trainerLeaveModel = sequelize.define(
  "trainerLeave",
  {
    tl_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tl_code: {
      type: DataTypes.STRING(100),
      allowNull: false,
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

    tl_date: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    tl_month: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    tl_subject: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    tl_body: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
    },
    tl_mt_comments: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    tl_admin_comments: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    tl_status: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    tl_submit_date: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
  },
  {
    tableName: "trainer_leaves",
    timestamps: false,
  }
);

trainerLeaveModel.belongsTo(TrainingBatch, {
  foreignKey: "tb_id",
  as: "training_batches",
});
trainerLeaveModel.belongsTo(Trainer, {
  foreignKey: "t_id",
  as: "trainers",
});
trainerLeaveModel.belongsTo(Center, { foreignKey: "center_id", as: "centers" });
trainerLeaveModel.belongsTo(Course, { foreignKey: "course_id", as: "courses" });

module.exports = trainerLeaveModel;
