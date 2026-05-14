const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const TrainingBatch = require("./trainingBatcheModel");
const Center = require("./center");

const HolidaysModel = sequelize.define(
  "Holidays",
  {
    h_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    h_date: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    h_reason: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    tb_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 6,
      references: {
        model: TrainingBatch,
        key: "tb_id",
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
  },
  {
    tableName: "holidays",
    timestamps: false,
  }
);
HolidaysModel.belongsTo(TrainingBatch, {
  foreignKey: "tb_id",
  as: "training_batches",
});
HolidaysModel.belongsTo(Center, {
  foreignKey: "center_id",
  as: "centers",
});

module.exports = HolidaysModel;
