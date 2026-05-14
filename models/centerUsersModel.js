const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");
const { sequelize } = require("../config/db");
const Center = require("./center");
const User = require("./userModel");
const CenterUserModel = sequelize.define(
  "centerusers",
  {
    cu_id: {
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
    center_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Center,
        key: "center_id",
      },
    },
    cu_status: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      validate: {
        isIn: [[0, 1]],
      },
    },
  },
  {
    tableName: "centerusers",
    timestamps: true,
  }
);
// Associations
CenterUserModel.belongsTo(Center, {
  foreignKey: "center_id",
  as: "center",
});
Center.hasOne(CenterUserModel, {
  foreignKey: "center_id",
  as: "centerUsers",
});
CenterUserModel.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});
module.exports = CenterUserModel;
