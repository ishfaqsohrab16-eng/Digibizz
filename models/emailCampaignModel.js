const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const TrainingBatch = require("./trainingBatcheModel");
const Center = require("./center");

/**
 * A bulk email run aimed at the candidates of one center.
 *
 * Sending is deliberately spread over time rather than fired in one burst: a
 * few hundred messages leaving the same IP in one minute is what gets a domain
 * blocklisted. `ec_batch_size` messages go out per `ec_interval_minutes` tick,
 * driven by utils/emailCampaignDispatcher.js.
 *
 * The recipient list is resolved and frozen when the campaign is created (see
 * email_campaign_recipients), so a campaign always sends to exactly the people
 * it was created for even if new applications arrive afterwards.
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
    tb_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: TrainingBatch, key: "tb_id" },
    },
    center_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Center, key: "center_id" },
    },
    /**
     * What this campaign is for. The date/time/venue columns below mean
     * different things per kind, which is why they are named generically:
     *
     *   initial        - interview call-up. Candidates never emailed before
     *                    for this center+batch.
     *   reminder       - chases an earlier campaign's recipients who still
     *                    have no interview recorded. Can carry a rescheduled
     *                    date, time and venue.
     *   recommendation - tells recommended candidates they are through, with
     *                    the class start date, timing and venue.
     *   general        - any other announcement, to candidates or students.
     */
    ec_kind: {
      type: DataTypes.ENUM("initial", "reminder", "recommendation", "general"),
      allowNull: false,
      defaultValue: "initial",
    },
    /**
     * Who the campaign targets.
     *
     * The module started as an admissions tool, so it only knew candidates.
     * Enrolled students are a different table with a different key, which is
     * why email_campaign_recipients now carries both cand_id and std_id and
     * exactly one of them is set per row.
     */
    ec_audience: {
      type: DataTypes.ENUM("candidates", "students"),
      allowNull: false,
      defaultValue: "candidates",
    },
    /** Set on reminders: the campaign whose recipients are being chased. */
    ec_source_campaign_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    /** How many candidates this run was created for. */
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
     * Event logistics rendered into the template.
     *
     * Named for the interview because that was the first use, but they are the
     * generic date/time/venue of whatever the campaign is about: the interview
     * for a call-up, the first class for a recommendation letter.
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
     * Author your own email instead of using the built-in letter.
     *
     * When set, this HTML IS the message - the built-in template is bypassed
     * entirely. Merge tokens ({{name}}, {{venue}}, ...) are substituted per
     * recipient and HTML-escaped on the way in, so a candidate whose name
     * contains an angle bracket cannot break the markup.
     *
     * NULL means "use the built-in interview letter".
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
