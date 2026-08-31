const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * Mail that could not be handed over yet, kept until it is.
 *
 * Every send used to be a single attempt: if Brevo refused and SMTP was not
 * tried, or both were unreachable for a minute, the message was gone. Nobody
 * found out until an applicant said they never got their code, and by then
 * there was nothing left to resend - the content only ever existed as
 * arguments on a stack.
 *
 * So a message that cannot be delivered immediately is written down here and
 * retried on a schedule, through whichever provider can carry it. A row leaves
 * this table in exactly two ways: it is sent, or it has failed enough times to
 * be declared dead - and dead rows raise an alert rather than going quiet.
 *
 * Attachments are deliberately NOT stored. They arrive as buffers and streams
 * that cannot be written to a column honestly, and a queued message that
 * silently lost its attachment is worse than one that failed loudly. Those
 * sends stay direct-only.
 */
const EmailOutbox = sequelize.define(
  "EmailOutbox",
  {
    eo_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    eo_to: {
      type: DataTypes.STRING(320),
      allowNull: false,
    },
    eo_cc: { type: DataTypes.STRING(320), allowNull: true },
    eo_bcc: { type: DataTypes.STRING(320), allowNull: true },
    eo_reply_to: { type: DataTypes.STRING(320), allowNull: true },

    eo_subject: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    eo_text: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },
    /** Campaign bodies are full HTML documents, so this needs the room. */
    eo_html: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },

    /**
     * Transactional mail is somebody waiting at a form; campaign mail is not.
     * It decides retry urgency and which SMTP transport carries it.
     */
    eo_priority: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    /** pending | sent | dead */
    eo_status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "pending",
    },
    eo_attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    /** Backoff. The drain only looks at rows that have come due. */
    eo_next_attempt_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    eo_last_error: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },

    /** Which provider finally carried it, for answering "did this go out?". */
    eo_provider: { type: DataTypes.STRING(20), allowNull: true },
    eo_message_id: { type: DataTypes.STRING(255), allowNull: true },
    eo_sent_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: "email_outbox",
    timestamps: true,
    indexes: [
      // The drain's only query: pending rows that have come due, oldest first.
      { fields: ["eo_status", "eo_next_attempt_at"], name: "email_outbox_due" },
    ],
  }
);

module.exports = EmailOutbox;
