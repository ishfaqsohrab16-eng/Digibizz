const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Center = require("./center");
const TrainingBatch = require("./trainingBatcheModel");

const CentersDatesModel = sequelize.define(
  "CentersDates",
  {
    cd_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
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
    tb_start: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    tb_end: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
  },
  {
    tableName: "centers_dates",
    timestamps: false,
  }
);

// Associations
CentersDatesModel.belongsTo(Center, {
  foreignKey: "center_id",
  as: "center",
});
CentersDatesModel.belongsTo(TrainingBatch, {
  foreignKey: "tb_id",
  as: "trainingBatch",
});

module.exports = CentersDatesModel;
