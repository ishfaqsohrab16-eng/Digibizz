const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Trainer = require("./trainersModel");
const TrainingBatch = require("./trainingBatcheModel");
const Center = require("./center");
const Course = require("./course");
const ticketModel = sequelize.define(
  "Ticket",
  {
    ticket_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    ticket_no: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    std_rollno: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    ticket_subject: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    ticket_description: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
    },
    ticket_attachment: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    tb_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    t_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    center_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    ticket_to: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    ticket_date: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    ticket_time: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    ticket_status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "UN-ANSWERED",
    },
  },
  {
    tableName: "tickets",
    timestamps: false,
  }
);


  ticketModel.belongsTo(TrainingBatch, { foreignKey: "tb_id", as: "training_batches" });
  ticketModel.belongsTo(Trainer, { foreignKey: "t_id", as: "trainers" });
  ticketModel.belongsTo(Center, { foreignKey: "center_id", as: "centers" });
  ticketModel.belongsTo(Course, { foreignKey: "course_id", as: "courses" });


module.exports = ticketModel;
