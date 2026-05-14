const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Ticket = require("./ticketModel");
const TicketReply = sequelize.define(
  "TicketReply",
  {
    treply_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    ticket_no: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    reply_by: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    reply_message: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
    },
    reply_attachment: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    reply_date: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    reply_time: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
  },
  {
    tableName: "ticket_replies",
    timestamps: false,
  }
);

module.exports = TicketReply;
