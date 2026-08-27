const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * One-time codes proving an applicant owns the address they typed.
 *
 * Applicants are told their interview date by email, so a typo in the address
 * means they never hear from the program and the seat is wasted. Confirming
 * the address while they are still on the form is the only point at which it
 * can be corrected.
 *
 * The code is stored hashed. This is a public, unauthenticated endpoint, so
 * anyone able to read the table must not be able to complete somebody else's
 * verification - and the code is short enough that storing it in the clear
 * would make that trivial.
 *
 * Rows are keyed by email; a new request replaces the old code rather than
 * accumulating rows, so an address can only ever have one live code.
 */
const EmailVerification = sequelize.define(
  "EmailVerification",
  {
    ev_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    /** Always stored lower-cased so casing cannot split one address in two. */
    ev_email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
    },
    ev_code_hash: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    ev_expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    /** Wrong guesses against the current code; caps brute force. */
    ev_attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    /** Codes issued in the current window; caps mail-bombing an address. */
    ev_sends: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    ev_last_sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    /** Set once the address is proven; the registration check reads this. */
    ev_verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ev_ip: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
  },
  {
    tableName: "email_verifications",
    timestamps: true,
    indexes: [{ unique: true, fields: ["ev_email"] }],
  }
);

module.exports = EmailVerification;
