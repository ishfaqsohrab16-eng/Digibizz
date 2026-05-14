const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Student = require("./studentModel");
const Trainer = require("./trainersModel");
const TrainingBatch = require("./trainingBatcheModel");
const Center = require("./center");
const Course = require("./course");

const EarningsModel = sequelize.define(
  "Earnings",
  {
    earning_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    std_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Student,
        key: "std_id",
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
    center_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Center,
        key: "center_id",
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
    earning_platform: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    earning_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    earning_proof: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    earning_status: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        isIn: [[0, 1, 2]], // 0: pending, 1: approved, 2: rejected
      },
    },
    earning_date: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
  },
  {
    tableName: "earnings",
    timestamps: false,
  }
);

EarningsModel.belongsTo(Student, { foreignKey: "std_id", as: "students" });
EarningsModel.belongsTo(Trainer, { foreignKey: "t_id", as: "trainers" });
EarningsModel.belongsTo(TrainingBatch, {
  foreignKey: "tb_id",
  as: "training_batches",
});
EarningsModel.belongsTo(Center, { foreignKey: "center_id", as: "centers" });
EarningsModel.belongsTo(Course, { foreignKey: "course_id", as: "courses" });

module.exports = EarningsModel;
