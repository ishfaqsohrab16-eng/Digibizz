const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * How much of the day's sending allowance has been used.
 *
 * Brevo's free plan allows 300 emails a day across everything - campaigns and
 * registration codes come out of the same pot. Without a count, a 400-address
 * campaign would spend the whole allowance in one afternoon and every applicant
 * for the rest of the day would be told "we could not send the code", with
 * nothing in this application able to explain why.
 *
 * One row per day, so the count survives a restart. An in-memory counter would
 * reset on every deploy and quietly let the day's limit be spent twice.
 *
 * Advisory, not authoritative: Brevo enforces the real limit. This exists so
 * campaigns stop early and leave headroom, and so an operator can see where the
 * day went.
 */
const EmailSendQuota = sequelize.define(
  "EmailSendQuota",
  {
    esq_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    /**
     * YYYY-MM-DD in the program's own timezone, not UTC - "today's limit" has
     * to mean the day the people running this are living in.
     */
    esq_date: {
      type: DataTypes.STRING(10),
      allowNull: false,
      unique: true,
    },
    esq_total: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    /** Registration codes, password resets - mail somebody is waiting on. */
    esq_transactional: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    /** Campaign and announcement mail. */
    esq_campaign: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "email_send_quota",
    timestamps: true,
    indexes: [{ unique: true, fields: ["esq_date"] }],
  }
);

module.exports = EmailSendQuota;
