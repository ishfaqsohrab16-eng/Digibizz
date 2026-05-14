const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Student = require("./studentModel");
const TrainingBatch = require("./trainingBatcheModel");
const Center = require("./center");
const Course = require("./course");

const ExamAssessment = sequelize.define(
  "ExamAssessment",
  {
    ea_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    std_cnic: {
      type: DataTypes.STRING(100),
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
    class_participation: {
      type: DataTypes.DECIMAL(10, 1),
      allowNull: false,
    },
    final_task: {
      type: DataTypes.DECIMAL(10, 1),
      allowNull: false,
    },
    presentation: {
      type: DataTypes.DECIMAL(10, 1),
      allowNull: false,
    },
    viva: {
      type: DataTypes.DECIMAL(10, 1),
      allowNull: false,
    },
    total_score: {
      type: DataTypes.DECIMAL(10, 1),
      allowNull: false,
    },
    ea_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
  },
  {
    tableName: "exam_assessment",
    timestamps: false,
  }
);

ExamAssessment.belongsTo(TrainingBatch, {
  foreignKey: "tb_id",
  as: "training_batches",
});
ExamAssessment.belongsTo(Center, { foreignKey: "center_id", as: "centers" });
ExamAssessment.belongsTo(Course, { foreignKey: "course_id", as: "courses" });

module.exports = ExamAssessment;
