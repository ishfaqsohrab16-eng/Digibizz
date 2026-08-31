const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * Addresses mailed through Brevo, held only long enough to clean up after.
 *
 * Brevo's transactional endpoint is documented as not creating contacts, but
 * "documented as not" is not the same as "does not", and an account that
 * quietly accumulates every applicant's address is a liability nobody would
 * notice until it mattered. So every address sent to is written down here and,
 * a day later, a delete is issued against the Brevo account for it.
 *
 * This table is itself a list of email addresses, which is the very thing being
 * cleaned up - so a row is deleted as soon as it has been dealt with. It holds
 * at most a day of sending, never a history.
 *
 * One row per address: mailing the same person twice pushes the deadline out
 * rather than queueing a second delete.
 */
const BrevoContact = sequelize.define(
  "BrevoContact",
  {
    bc_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    bc_email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
    },
    /**
     * When the contact may be removed - 24 hours after the LAST message, not
     * the first. Deleting a contact mid-conversation would achieve nothing
     * except a delete that has to happen again tomorrow.
     */
    bc_delete_after: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    /** Failed delete attempts; caps how long a stuck row is retried. */
    bc_attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    bc_last_error: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: "brevo_contacts",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["bc_email"] },
      // The sweep asks for "everything due", every half hour, forever.
      { fields: ["bc_delete_after"] },
    ],
  }
);

module.exports = BrevoContact;
