const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Trainer = require("./trainersModel");
const MasterTrainer = require("./masterTrainersModel");

/**
 * A Master Trainer's weekly evaluation of one trainer.
 *
 * The paper form is "DigiBizz Program Weekly M&E Report - Trainers
 * Performance", signed by the M&E Officer and the Master Trainer. This is that
 * form, with everything the LMS already knows filled in before the MT starts.
 *
 * ONE REPORT PER TRAINER PER WEEK, not per class. A trainer teaching three
 * classes is one person whose punctuality and lecture reports are being
 * assessed, and three near-identical forms would be three chances to disagree
 * with yourself. The classes covered are recorded on the report so the reader
 * knows its scope; the unique index on (t_id, we_week_key) makes a second
 * report for the same week impossible rather than merely discouraged.
 *
 * WHAT IS STORED AND WHY THERE ARE TWO COPIES OF THE NUMBERS
 *
 * Every countable figure is computed from the LMS and offered to the MT, who
 * may correct it - they were in the room and the system was not. Both are
 * kept: `we_auto` is what the system said at submission time, the columns are
 * what the MT signed for. Where they differ, that difference is itself worth
 * seeing, and without the snapshot it would be invisible - the underlying
 * data moves on and next month nobody could reconstruct what was on screen.
 */
const WeeklyEvaluation = sequelize.define(
  "WeeklyEvaluation",
  {
    we_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    t_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Trainer, key: "t_id" },
      comment: "The trainer being evaluated.",
    },
    mt_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: MasterTrainer, key: "mt_id" },
      comment: "The Master Trainer who filled the report in.",
    },

    /** "2026-W37". The unique half of one report per trainer per week. */
    we_week_key: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    we_week_start: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: "Monday. The From Date on the paper form.",
    },
    we_week_end: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: "Friday. The To Date on the paper form.",
    },

    /**
     * The day grid: four criteria across five teaching days.
     *
     * JSON rather than twenty columns. The paper form has a blank fifth row
     * for a criterion someone adds by hand, and twenty columns could not carry
     * one without a migration. Shaped as
     * { lecture_reports: { mon: true, tue: false, ... }, ... }.
     */
    we_daily: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },

    /** The extra row the paper form leaves empty, when the MT uses it. */
    we_custom_label: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },

    we_assignments: { type: DataTypes.INTEGER, allowNull: true },
    we_quizzes: { type: DataTypes.INTEGER, allowNull: true },

    we_quality: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "Excellent | Good | Satisfactory | Poor",
    },

    we_mt_visit_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "Date of Visit of MT in the last week. Nothing to compute this from.",
    },

    we_enrolled_start: { type: DataTypes.INTEGER, allowNull: true },
    we_dropouts: { type: DataTypes.INTEGER, allowNull: true },
    we_new_enrolled: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Not on the paper form. Asked for alongside drop-outs, and derivable.",
    },
    we_on_leave: { type: DataTypes.INTEGER, allowNull: true },

    we_feedback_submission: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: "Trainees' Feedback Submission: Yes | No",
    },

    we_other_tasks: { type: DataTypes.TEXT, allowNull: true },
    we_remarks: { type: DataTypes.TEXT, allowNull: true },

    /**
     * The classes this trainer was teaching when the report was written.
     *
     * A snapshot, not a join. An allocation can be changed afterwards, and a
     * report has to keep saying which classes it covered.
     */
    we_classes: { type: DataTypes.JSON, allowNull: true },

    /** What the LMS computed at submission time. See the note above. */
    we_auto: { type: DataTypes.JSON, allowNull: true },

    /**
     * draft while the MT is still filling it in, submitted once signed off.
     *
     * A draft is the MT's own working copy: admins do not see it, and it does
     * not satisfy the week's obligation. The form is long enough that losing a
     * half-filled one to a closed tab would be its own reason not to use this.
     */
    we_status: {
      type: DataTypes.STRING(12),
      allowNull: false,
      defaultValue: "draft",
      validate: { isIn: [["draft", "submitted"]] },
    },

    we_submitted_on: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: "weekly_evaluations",
    timestamps: true,
    createdAt: "we_created_on",
    updatedAt: "we_updated_on",
    indexes: [
      // One report per trainer per week, enforced by the database rather than
      // by a check that races with a second browser tab.
      { unique: true, fields: ["t_id", "we_week_key"], name: "weekly_evaluations_trainer_week" },
      { fields: ["mt_id", "we_week_key"], name: "weekly_evaluations_mt_week" },
      { fields: ["we_week_key", "we_status"], name: "weekly_evaluations_week_status" },
    ],
  }
);

WeeklyEvaluation.belongsTo(Trainer, { foreignKey: "t_id", as: "trainer" });
WeeklyEvaluation.belongsTo(MasterTrainer, { foreignKey: "mt_id", as: "masterTrainer" });

module.exports = WeeklyEvaluation;
