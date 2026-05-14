const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Trainer = require("./trainersModel");
const TrainingBatch = require("./trainingBatcheModel");
const Center = require("./center");
const Course = require("./course");
const LearningResource = sequelize.define(
  "LearningResource",
  {
    ls_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    ls_title: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    ls_description: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
    },
    ls_attachment: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    t_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    center_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    tb_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ls_added_on: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
  },
  {
    tableName: "learning_resources",
    timestamps: false,
  }
);

  LearningResource.belongsTo(Trainer, { foreignKey: "t_id", as: "trainers" });
  LearningResource.belongsTo(TrainingBatch, { foreignKey: "tb_id", as: "training_batches" });
  LearningResource.belongsTo(Center, { foreignKey: "center_id", as: "centers" });
  LearningResource.belongsTo(Course, { foreignKey: "course_id", as: "courses" });


module.exports = LearningResource;
