const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const EmailCampaign = require("./emailCampaignModel");
const Candidate = require("./CandidateModel");
const Student = require("./studentModel");
const Course = require("./course");

/**
 * One row per candidate per campaign - the frozen send list.
 *
 * This table is also the "who has already been contacted" ledger: a new
 * `initial` campaign for a center excludes every candidate that appears here
 * for that center and batch, which is what makes "send to the next 200" work
 * without re-mailing the first 200.
 *
 * The unique (ec_id, cand_id) index means a retry or a double-click on Create
 * can never queue the same person twice inside one campaign.
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
     * Exactly one of cand_id / std_id is set, depending on the campaign's
     * audience. Candidates and students live in different tables with
     * different keys, and a single "recipient_id" column would lose which
     * table it pointed at - so both are kept, both nullable.
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
    /** Snapshotted so a later edit to the candidate cannot silently redirect mail. */
    ecr_email: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    ecr_name: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    /** Kept for the per-course quota reporting on the campaign detail screen. */
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
      // One row per person per campaign, whichever kind of person they are.
      // MySQL allows repeated NULLs in a unique index, so a student-audience
      // campaign (every cand_id NULL) does not collide with itself.
      { unique: true, fields: ["ec_id", "cand_id"] },
      { unique: true, fields: ["ec_id", "std_id"] },
      { fields: ["ec_id", "ecr_status"] },
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
