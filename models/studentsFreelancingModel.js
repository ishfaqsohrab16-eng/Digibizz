const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const StudentsFreelancing = sequelize.define(
  "StudentsFreelancing",
  {
    sfp_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    std_cnic: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    ep_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    sfp_link: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    sfp_status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    sfp_date: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
  },
  {
    tableName: "students_freelancing_profiles",
    timestamps: false,
  }
);

module.exports = StudentsFreelancing;
