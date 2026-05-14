const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const CenterModel = sequelize.define(
  "Center",
  {
    center_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    center_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255],
      },
    },
    center_location: {
      type: DataTypes.TEXT("medium"),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    center_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    center_medium: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "Physical",
      validate: {
        isIn: [["Physical", "Online", "Hybrid"]],
      },
    },
    center_status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        isIn: [[0, 1]],
      },
    },
  },
  {
    tableName: "centers",
    timestamps: true,
  }
);

module.exports = CenterModel;
