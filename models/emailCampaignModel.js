const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const TrainingBatch = require("./trainingBatcheModel");
const Center = require("./center");

/**
 * A bulk email run addressed to an uploaded list of addresses.
 *
 * This module is standalone: a campaign is a subject, a body, and a list of
 * addresses read from a spreadsheet. It used to be an admissions feature that
 * resolved its recipients out of the candidates or students tables for one
 * center and batch; those columns are kept NULLABLE below so historical
 * campaigns still read correctly, but nothing writes them any more.
 *
 * Sending is deliberately spread over time rather than fired in one burst: a
 * few hundred messages leaving the same IP in one minute is what gets a domain
 * blocklisted. `ec_batch_size` messages go out per `ec_interval_minutes` tick,
 * driven by utils/emailCampaignDispatcher.js.
 *
 * The recipient list is frozen when the campaign is created (see
 * email_campaign_recipients), so a campaign always sends to exactly the list it
 * was created from.
 */
const EmailCampaign = sequelize.define(
  "EmailCampaign",
  {
    ec_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    ec_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    /**
     * LEGACY, nullable. The batch and center a campaign was scoped to back when
     * recipients were resolved from the candidates table. New campaigns leave
     * both NULL - an uploaded list is addressed to itself, not to a center.
     * Kept so campaigns sent before this change still show where they went.
     */
    tb_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: TrainingBatch, key: "tb_id" },
    },
    center_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: Center, key: "center_id" },
    },
    /**
     * LEGACY, nullable. There was once an interview call-up, a reminder, a
     * recommendation letter and a general announcement, each rendering a
     * different built-in template. There is one kind now - the operator writes
     * the email - so new rows leave this NULL.
     */
    ec_kind: {
      type: DataTypes.ENUM("initial", "reminder", "recommendation", "general"),
      allowNull: true,
      defaultValue: null,
    },
    /**
     * LEGACY, nullable. Recipients used to be candidates or enrolled students
     * looked up in the database. Every campaign is now an uploaded list.
     */
    ec_audience: {
      type: DataTypes.ENUM("candidates", "students", "list"),
      allowNull: true,
      defaultValue: null,
    },
    /** LEGACY, nullable. Reminders chased an earlier campaign's recipients. */
    ec_source_campaign_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    /** How many addresses this run was created for. */
    ec_target_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    /** Messages released per tick. */
    ec_batch_size: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 25,
    },
    /** Nominal minutes between ticks, before jitter is applied. */
    ec_interval_minutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 15,
    },
    /**
     * Random gap between two individual messages inside one chunk.
     *
     * A fixed cadence is itself a spam signal - a burst of messages spaced
     * exactly N seconds apart reads as automation to every major filter. Each
     * send waits a random number of seconds in [min, max] instead, and the
     * gap between chunks is jittered the same way (see ec_next_run_at).
     */
    ec_min_gap_seconds: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 8,
    },
    ec_max_gap_seconds: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
    },
    /**
     * When the next chunk becomes due, already jittered. Persisted rather than
     * recomputed so a restart cannot reset the schedule and fire early.
     */
    ec_next_run_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ec_subject: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    /**
     * LEGACY, all nullable. Event logistics that the built-in interview and
     * recommendation letters rendered into a details table. Nothing writes them
     * now: a campaign body is authored in full by the operator, and anything
     * like a date or venue is simply typed into it. Retained so an old
     * campaign's detail screen is not left with blank fields.
     */
    ec_interview_date: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    ec_interview_time: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    ec_venue: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    ec_reporting_time: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    ec_contact_person: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    ec_contact_phone: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    /** Free-text paragraph added above the details table. */
    ec_message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    /**
     * The email body. This HTML IS the message.
     *
     * Required in practice - the controller refuses to create a campaign
     * without it - but left nullable at the column level because campaigns
     * created before this change used a built-in template and legitimately have
     * none.
     *
     * Merge tokens ({{name}}, or any column name from the uploaded sheet) are
     * substituted per recipient and HTML-escaped on the way in, so an address
     * list containing an angle bracket cannot break the markup.
     */
    ec_custom_html: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },
    ec_status: {
      type: DataTypes.ENUM(
        "draft",
        "running",
        "paused",
        "completed",
        "cancelled"
      ),
      allowNull: false,
      defaultValue: "draft",
    },
    /** When the dispatcher last released a chunk; drives the interval. */
    ec_last_run_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ec_created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "email_campaigns",
    timestamps: true,
    indexes: [{ fields: ["tb_id", "center_id"] }, { fields: ["ec_status"] }],
  }
);

EmailCampaign.belongsTo(TrainingBatch, { foreignKey: "tb_id", as: "batch" });
EmailCampaign.belongsTo(Center, { foreignKey: "center_id", as: "center" });

module.exports = EmailCampaign;
