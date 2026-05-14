const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const TrainingBatch = require("./trainingBatcheModel");
const Center = require("./center");
const Trainer = require("./trainersModel");
const Course = require("./course");

const StudentsFeedback = sequelize.define(
  "StudentsFeedback",
  {
    sf_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    std_rollno: {
      type: DataTypes.STRING(50),
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
    t_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Trainer,
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
    sf_lecture: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    sf_queries: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    sf_knowledge: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    sf_punctuality: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    sf_trainer_feedback: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    sf_lab_clean: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    sf_lab_internet: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    sf_lab_feedback: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    sf_date: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    sf_month: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
  },
  {
    tableName: "students_feedback",
    timestamps: false,
  }
);

StudentsFeedback.belongsTo(TrainingBatch, {
  foreignKey: "tb_id",
  as: "training_batch",
});
StudentsFeedback.belongsTo(Center, {
  foreignKey: "center_id",
  as: "centers",
});
StudentsFeedback.belongsTo(Trainer, {
  foreignKey: "t_id",
  as: "trainer",
});
StudentsFeedback.belongsTo(Course, {
  foreignKey: "course_id",
  as: "courses",
});

module.exports = StudentsFeedback;
