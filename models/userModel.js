const { DataTypes } = require("sequelize");
const crypto = require("crypto"); // Import the crypto module
const { sequelize } = require("../config/db");

const userModel = sequelize.define(
  "user",
  {
    user_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 50],
      },
    },
    user_username: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    user_email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [1, 100],
      },
    },
    user_password: {
      type: DataTypes.STRING(255),
      allowNull: true, // Allow null values
    },
    user_profile_photo: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    user_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "Contentuser",
      validate: {
        isIn: [
          [
            "SuperAdmin",
            "ContentAdmin",
            "ReadOnlyAdmin",
            "MasterTrainer",
            "trainer",
            "student",
            "Coordinator",
            "Manager",
            "Center Manager",
          ],
        ],
      },
    },
    user_status: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      validate: {
        isIn: [[0, 1]],
      },
    },
  },
  {
    tableName: "user",
    timestamps: true,
    hooks: {
      beforeCreate: async (user) => {
        if (user.user_password) {
          user.user_password = crypto
            .createHash("sha1")
            .update(user.user_password)
            .digest("hex");
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed("user_password")) {
          user.user_password = crypto
            .createHash("sha1")
            .update(user.user_password)
            .digest("hex");
        }
      },
    },
  }
);

// Method to validate password (using SHA-1)
userModel.prototype.validPassword = function (password) {
  const hashedPassword = crypto
    .createHash("sha1")
    .update(password)
    .digest("hex");
  return this.user_password === hashedPassword;
};

// Define associations
userModel.associate = (models) => {
  userModel.hasOne(models.Admin, { foreignKey: "user_id" });
  userModel.hasOne(models.MasterTrainer, { foreignKey: "user_id" });
  userModel.hasOne(models.Trainer, { foreignKey: "user_id" });
  userModel.hasOne(models.Student, { foreignKey: "user_id" });
  userModel.hasOne(models.CenterUser, { foreignKey: "user_id" });
};

module.exports = userModel;
