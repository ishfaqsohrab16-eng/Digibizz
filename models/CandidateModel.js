const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const CourseModel = require("./course");
const TrainingBatch = require("./trainingBatcheModel");
const CenterModel = require("./center");

const CandidateModel = sequelize.define(
  "Candidate",
  {
    cand_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    cand_cnic: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    cand_photo: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    cand_name: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    cand_fathername: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    tb_id: {
      type: DataTypes.INTEGER,
      references: {
        model: TrainingBatch,
        key: "tb_id",
      },
      allowNull: false,
    },
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: CourseModel,
        key: "course_id",
      },
    },
    center_id: {
      type: DataTypes.INTEGER,
      references: {
        model: CenterModel,
        key: "center_id",
      },
      allowNull: false,
    },
    cand_email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },
    cand_phone: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    cand_whatsapp: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    cand_gender: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    cand_dob: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    cand_local_domicile: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    cand_degree_level: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    degree_area: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    institute: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    degree_start_date: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    degree_end_date: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    current_address: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    permanent_address: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    current_city: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    permanent_city: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    cand_test_code: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    cand_test_marks: {
      type: DataTypes.STRING(5),
      allowNull: false,
    },
    cand_interview_marks: {
      type: DataTypes.STRING(50),
      defaultValue: "TBD",
    },
    cand_admission_status: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    cand_apply_date: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    reject_reason: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    laptop_pc: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    recommended: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    course_second_priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    center_second_priority: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    interview_date: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
  },
  {
    tableName: "candidates",
    timestamps: false,
  }
);

// Define association with Course
CandidateModel.belongsTo(CourseModel, {
  foreignKey: "course_id",
  as: "courses",
});
CandidateModel.belongsTo(CenterModel, {
  foreignKey: "center_id",
  as: "centers",
});
CandidateModel.belongsTo(TrainingBatch, {
  foreignKey: "tb_id",
  as: "training_batches",
});

module.exports = CandidateModel;
