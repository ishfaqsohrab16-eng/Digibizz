const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const MasterTrainer = require("./masterTrainersModel");
const TrainingBatch = require("./trainingBatcheModel");

/**
 * The weekly Online Classes Report: one online or hybrid centre, one week.
 *
 * The M&E report for classes nobody can walk into. Physical centres are
 * reported per trainer (weekly_evaluations); online and hybrid centres are
 * reported per CENTRE, here, because what there is to say - is the lab
 * attendant marking the register, is the trainer joining - is about the
 * centre, not about any one trainer.
 *
 * ONE REPORT PER CENTRE PER WEEK, BETWEEN ALL MASTER TRAINERS. Whoever starts
 * it first has it; nobody else can file a second. The unique index is what
 * makes that true - the application checks first only so the refusal can
 * say something useful - and it holds even when two people press Submit in
 * the same second.
 *
 * The daily counts are SNAPSHOTTED on submission. The register can be edited
 * afterwards, and a signed report should still say what the register said
 * when it was signed.
 */

/** A JSON column that also survives drivers returning JSON as a string. */
const jsonColumn = (name, fallback) => ({
  get() {
    const value = this.getDataValue(name);
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    }
    return value ?? fallback;
  },
});

const OnlineClassReport = sequelize.define(
  "OnlineClassReport",
  {
    ocr_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    mt_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: MasterTrainer, key: "mt_id" },
      comment: "The Master Trainer who filed it.",
    },

    ocr_center_id: { type: DataTypes.INTEGER, allowNull: false },
    /** Kept by name too, so the report still reads if the centre is renamed. */
    ocr_center_name: { type: DataTypes.STRING(255), allowNull: false },
    ocr_medium: { type: DataTypes.STRING(20), allowNull: true },

    tb_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: TrainingBatch, key: "tb_id" },
    },

    /** The M&E week: the key is the starting Friday's date. */
    ocr_week_key: { type: DataTypes.STRING(10), allowNull: false },
    ocr_week_start: { type: DataTypes.DATEONLY, allowNull: false },
    ocr_week_end: { type: DataTypes.DATEONLY, allowNull: false },

    /** { students_attendance, trainers_attendance, lab_feedback, mt_took_class } */
    ocr_answers: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
      ...jsonColumn("ocr_answers", {}),
    },

    /**
     * [{ course_id, course_name, days: { fri: { P, A, L, marked }, ... } }]
     * Null until submitted; a draft reads the register live.
     */
    ocr_attendance: {
      type: DataTypes.JSON,
      allowNull: true,
      ...jsonColumn("ocr_attendance", null),
    },

    ocr_remarks: { type: DataTypes.TEXT, allowNull: true },

    ocr_status: {
      type: DataTypes.STRING(12),
      allowNull: false,
      defaultValue: "draft",
      validate: { isIn: [["draft", "submitted", "reviewed"]] },
    },
    ocr_submitted_on: { type: DataTypes.DATE, allowNull: true },

    ocr_reviewed_by: { type: DataTypes.INTEGER, allowNull: true },
    ocr_reviewed_by_name: { type: DataTypes.STRING(150), allowNull: true },
    ocr_reviewed_on: { type: DataTypes.DATE, allowNull: true },
    ocr_review_note: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: "online_class_reports",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["ocr_center_id", "tb_id", "ocr_week_key"],
        name: "online_class_reports_center_batch_week",
      },
      { fields: ["mt_id", "ocr_week_key"], name: "online_class_reports_mt_week" },
      {
        fields: ["tb_id", "ocr_week_key", "ocr_status"],
        name: "online_class_reports_batch_week",
      },
    ],
  }
);

module.exports = OnlineClassReport;
