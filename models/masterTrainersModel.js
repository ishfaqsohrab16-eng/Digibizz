const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");
const { sequelize } = require("../config/db");
const Course = require("./course");
const User = require("./userModel");

const MasterTrainerModel = sequelize.define(
  "MasterTrainer",
  {
    mt_id: {
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
    mt_course_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Course,
        key: "course_id",
      },
    },
    mt_added_on: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    mt_dark_mode: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        isIn: [[0, 1]],
      },
    },
  },
  {
    tableName: "mastertrainers",
    timestamps: false,
  }
);

// Associations
MasterTrainerModel.belongsTo(Course, {
  foreignKey: "mt_course_id",
  as: "course",
});
MasterTrainerModel.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});

module.exports = MasterTrainerModel;
