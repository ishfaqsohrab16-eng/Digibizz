const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const MasterTrainer = require("./masterTrainersModel");
const TrainingBatch = require("./trainingBatcheModel");

/**
 * A Master Trainer's weekly visit to one centre.
 *
 * The paper "Visit Report Proforma": did the trainer arrive on time, was the
 * lab attendant there, was there electricity, did the projector work. One row
 * per centre per week, with photographs or video from the visit attached.
 *
 * center_id IS NOT A FOREIGN KEY, deliberately. Zero means the Online Cell -
 * the single virtual centre standing for every online and hybrid centre, which
 * nobody travels to and which gets one form between them. A foreign key would
 * make that impossible to represent without inventing a row in `centers` that
 * is not a centre.
 *
 * WHO FILES WHAT DIFFERS BY CENTRE, and cv_owner_id is how that is expressed.
 *
 *   A PHYSICAL CENTRE is visited by every Master Trainer, each filing their
 *   own report. cv_owner_id is their mt_id, so the unique index permits one
 *   report per MT per centre per week. They go on different days and see
 *   different things, and collapsing that into one report would throw away
 *   the disagreement - which is the most informative part of it.
 *
 *   THE ONLINE CELL is filed once by whoever gets to it first. cv_owner_id is
 *   0 for every such report, so the unique index permits exactly one.
 *
 * A single column rather than two constraints, because "unique on these
 * columns, except when this other column is 0" is not something a database can
 * express - and enforcing it in the application alone would race between two
 * browser tabs. mt_id still records who actually filed it either way.
 */
const CenterVisit = sequelize.define(
  "CenterVisit",
  {
    cv_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    mt_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: MasterTrainer, key: "mt_id" },
      comment: "The Master Trainer who made the visit.",
    },

    /**
     * Whose report this is, for uniqueness. See the note above.
     *
     * The Master Trainer's id at a physical centre; 0 for the Online Cell,
     * which has one report between everybody.
     */
    cv_owner_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "mt_id at a physical centre; 0 for the Online Cell.",
    },

    /** 0 for the Online Cell. See the note above. */
    cv_center_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "The centre visited. 0 is the Online Cell.",
    },
    /** The centre's name as it was, so an old report reads after a rename. */
    cv_center_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    tb_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: TrainingBatch, key: "tb_id" },
      comment: "The batch whose classes were running there.",
    },

    /** The Friday the report week starts on. See utils/evaluationWeek.js. */
    cv_week_key: { type: DataTypes.STRING(10), allowNull: false },
    cv_week_start: { type: DataTypes.DATEONLY, allowNull: false },
    cv_week_end: { type: DataTypes.DATEONLY, allowNull: false },

    /**
     * When the visit actually happened.
     *
     * Not the same as the week: a visit made on Tuesday is reported in
     * Tuesday's week, and the form asks for the date and time because the
     * answers depend on them - "was there electricity" is a question about a
     * particular afternoon.
     */
    cv_visit_date: { type: DataTypes.DATEONLY, allowNull: true },
    cv_visit_time: { type: DataTypes.STRING(10), allowNull: true },

    /**
     * The answers, keyed by question.
     *
     * { trainer_on_time: { answer: "Yes", note: null }, ... }
     *
     * JSON rather than a column per question, because the proforma is a paper
     * form that will gain a row the moment somebody thinks of one, and a
     * migration per question would guarantee it never does.
     */
    cv_answers: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },

    /** The overall remarks for the centre, at the foot of the form. */
    cv_remarks: { type: DataTypes.TEXT, allowNull: true },

    /**
     * Photographs or video from the visit.
     *
     * [{ file: "visit-172...jpg", type: "image", size: 402113 }]
     *
     * The evidence the visit happened. Stored as a list of file names under
     * uploads/center-visits rather than as blobs - the same as every other
     * upload in this application.
     */
    cv_media: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    },

    /**
     * draft -> submitted -> reviewed.
     *
     * The same three states as the weekly M&E report, and for the same reason:
     * a draft is the author's own, submitted is signed off, and reviewed means
     * a Super Admin has read it and the Master Trainer can see that they have.
     */
    cv_status: {
      type: DataTypes.STRING(12),
      allowNull: false,
      defaultValue: "draft",
      validate: { isIn: [["draft", "submitted", "reviewed"]] },
    },

    cv_submitted_on: { type: DataTypes.DATE, allowNull: true },

    cv_reviewed_by: { type: DataTypes.INTEGER, allowNull: true },
    cv_reviewed_by_name: { type: DataTypes.STRING(150), allowNull: true },
    cv_reviewed_on: { type: DataTypes.DATE, allowNull: true },
    cv_review_note: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: "center_visits",
    timestamps: true,
    createdAt: "cv_created_on",
    updatedAt: "cv_updated_on",
    indexes: [
      {
        unique: true,
        fields: ["cv_owner_id", "cv_center_id", "tb_id", "cv_week_key"],
        name: "center_visits_owner_center_batch_week",
      },
      { fields: ["mt_id", "cv_week_key"], name: "center_visits_mt_week" },
      { fields: ["tb_id", "cv_week_key", "cv_status"], name: "center_visits_batch_week" },
    ],
  }
);

CenterVisit.belongsTo(MasterTrainer, { foreignKey: "mt_id", as: "masterTrainer" });
CenterVisit.belongsTo(TrainingBatch, { foreignKey: "tb_id", as: "batch" });

module.exports = CenterVisit;
