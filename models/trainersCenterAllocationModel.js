const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");
const { sequelize } = require("../config/db");
const TrainerModel = require("./trainersModel");
const Center = require("./center");
const TrainingBatch = require("./trainingBatcheModel");
const Course = require("./course");

const TrainersCenterAllocationModel = sequelize.define(
  "TrainersCenterAllocation",
  {
    tca_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    t_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: TrainerModel,
        key: "t_id",
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
    tb_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: TrainingBatch,
        key: "tb_id",
      },
    },
  },
  {
    tableName: "trainers_center_allocation",
    timestamps: false,
  }
);

// Associations
TrainersCenterAllocationModel.belongsTo(TrainerModel, {
  foreignKey: "t_id",
  as: "trainer",
});

TrainersCenterAllocationModel.belongsTo(TrainingBatch, {
  foreignKey: "tb_id",
  as: "training_batch",
});

TrainersCenterAllocationModel.belongsTo(Center, {
  foreignKey: "center_id",
  as: "center",
});

TrainersCenterAllocationModel.belongsTo(Course, {
  foreignKey: "course_id",
  as: "course",
});

module.exports = TrainersCenterAllocationModel;
