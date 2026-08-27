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
      type: DataTypes.TEXT("long"),
      allowNull: true,
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
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },
    sf_date: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    sf_month: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    /**
     * ISO week key ("2026-W34") of the submission.
     *
     * Feedback is once per week, on any day of that week. Storing the week
     * makes the rule enforceable by a unique index rather than by a
     * check-then-insert, which two quick clicks can race past.
     */
    sf_week: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
  },
  {
    tableName: "students_feedback",
    timestamps: false,
    indexes: [
      // One submission per student, per batch, per week. Existing rows have a
      // NULL sf_week and MySQL allows repeated NULLs in a unique index, so
      // history is unaffected.
      {
        unique: true,
        name: "students_feedback_once_per_week",
        fields: ["std_rollno", "tb_id", "sf_week"],
      },
    ],
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
