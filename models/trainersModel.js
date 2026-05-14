const { DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");
const { sequelize } = require("../config/db");
const Course = require("./course");
const MasterTrainer = require("./masterTrainersModel");
const User = require("./userModel");
const Center = require("./center");
const TrainerModel = sequelize.define(
  "trainer",
  {
    t_id: {
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
    t_cnic: {
      type: DataTypes.STRING(15),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
      },
    },
    mt_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: MasterTrainer,
        key: "mt_id",
      },
    },
    t_course_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Course,
        key: "course_id",
      },
    },
    t_added_on: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    dark_mode: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        isIn: [[0, 1]],
      },
    },
    t_status: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        isIn: [[0, 1]],
      },
    },
  },
  {
    tableName: "trainers",
    timestamps: false,
  }
);

// Method to validate password
TrainerModel.prototype.validPassword = async function (password) {
  return await bcrypt.compare(password, this.t_password);
};

// Associations
TrainerModel.belongsTo(Course, {
  foreignKey: "t_course_id",
  as: "course",
});
TrainerModel.belongsTo(User, {
  foreignKey: "user_id",
  as: "user",
});
TrainerModel.belongsTo(MasterTrainer, {
  foreignKey: "mt_id",
  as: "masterTrainer",
});
module.exports = TrainerModel;
