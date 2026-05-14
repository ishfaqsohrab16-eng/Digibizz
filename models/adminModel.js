const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");
const { sequelize } = require("../config/db");
const User = require("./userModel");

const adminModel = sequelize.define(
  "admin",
  {
    admin_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 6,
      references: {
        model: User,
        key: "user_id",
      },
    },
    dark_mode: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        isIn: [[0, 1]],
      },
    },
    admin_status: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      validate: {
        isIn: [[0, 1]],
      },
    },
  },
  {
    tableName: "admins",
    timestamps: true,
  }
);
adminModel.associate = function (models) {
  adminModel.belongsTo(models.User, {
    foreignKey: "user_id",
    as: "user", // This alias must match the one in the include
  });
};
module.exports = adminModel;
