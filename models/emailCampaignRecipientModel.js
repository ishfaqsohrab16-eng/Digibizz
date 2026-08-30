const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const EmailCampaign = require("./emailCampaignModel");
const Candidate = require("./CandidateModel");
const Student = require("./studentModel");
const Course = require("./course");

/**
 * One row per address per campaign - the frozen send list.
 *
 * A recipient is an email address and whatever else its spreadsheet row
 * carried. It is not required to correspond to anybody in this database:
 * cand_id and std_id are legacy columns from when campaigns were resolved out
 * of the candidates and students tables, and are NULL for every list campaign.
 *
 * Duplicates are removed twice before a row reaches here - once by the parser
 * while reading the file, once on insert - because a unique index on
 * (ec_id, ecr_email) could not be built: two different candidates in an old
 * campaign can legitimately share one address.
 */
const EmailCampaignRecipient = sequelize.define(
  "EmailCampaignRecipient",
  {
    ecr_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    ec_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: EmailCampaign, key: "ec_id" },
    },
    /**
     * LEGACY, both nullable and both NULL for list campaigns. Recipients used
     * to be a candidate or an enrolled student; these recorded which. Kept so
     * historical campaigns still join to the person they were sent to.
     */
    cand_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: Candidate, key: "cand_id" },
    },
    std_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: Student, key: "std_id" },
    },
    /** The address the message goes to. The whole identity of a list recipient. */
    ecr_email: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    /** Optional display name from the sheet's Name column, used for {{name}}. */
    ecr_name: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    /** LEGACY, nullable. Per-course quota reporting on old admissions runs. */
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: Course, key: "course_id" },
    },
    ecr_status: {
      type: DataTypes.ENUM("pending", "sent", "failed", "skipped"),
      allowNull: false,
      defaultValue: "pending",
    },
    ecr_sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ecr_attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    /**
     * Every other column from the recipient's spreadsheet row, as JSON.
     *
     * A list recipient has no database record behind it, so anything the
     * message wants to say about them - {{course}}, {{city}}, {{amount}} -
     * comes from here. Whatever headings the file carried become tokens, so a
     * campaign can use fields this code has never heard of.
     */
    ecr_merge_data: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    /** Last SMTP error, truncated - enough to tell a bad address from a refusal. */
    ecr_error: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
  },
  {
    tableName: "email_campaign_recipients",
    timestamps: true,
    indexes: [
      // Legacy uniqueness, retained for old rows. MySQL allows repeated NULLs
      // in a unique index, so list campaigns - where both are NULL on every
      // row - do not collide with themselves.
      { unique: true, fields: ["ec_id", "cand_id"] },
      { unique: true, fields: ["ec_id", "std_id"] },
      // Drives the dispatcher's "next pending for this campaign" query.
      { fields: ["ec_id", "ecr_status"] },
      // De-duplicating an upload against what is already queued. NOT unique:
      // two candidates in an old campaign may share an address.
      { fields: ["ec_id", "ecr_email"] },
      { fields: ["cand_id"] },
      { fields: ["std_id"] },
    ],
  }
);

EmailCampaignRecipient.belongsTo(EmailCampaign, {
  foreignKey: "ec_id",
  as: "campaign",
});
EmailCampaignRecipient.belongsTo(Candidate, {
  foreignKey: "cand_id",
  as: "candidate",
});
EmailCampaignRecipient.belongsTo(Student, {
  foreignKey: "std_id",
  as: "student",
});
EmailCampaignRecipient.belongsTo(Course, {
  foreignKey: "course_id",
  as: "course",
});
EmailCampaign.hasMany(EmailCampaignRecipient, {
  foreignKey: "ec_id",
  as: "recipients",
});

module.exports = EmailCampaignRecipient;
