const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * When a class actually starts, and at what times, per centre and course.
 *
 * Deliberately its own table rather than columns on the course or the batch.
 * The same course runs at several centres and does not start on the same day or
 * at the same hour in each of them - a morning class in Quetta and an evening
 * one in Turbat are the same course. Anything hung off the course record would
 * have to be one answer for all of them, and it would be wrong for most.
 *
 * It is also allowed to disagree with whatever the batch record says. The batch
 * dates are a plan; this is what the centre is telling the student, and the
 * student turns up on the strength of it. That is why it is entered by hand
 * rather than derived.
 *
 * Filled in BEFORE anyone is enrolled at that centre: the enrolment email
 * quotes these values, and an email that tells an applicant to arrive on a
 * blank date is worse than no email at all. Enrolment refuses to proceed
 * without it, and says which class is missing one.
 *
 * One row per (centre, course, batch).
 */
const ClassSchedule = sequelize.define(
  "ClassSchedule",
  {
    cs_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    center_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    course_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    /**
     * Timings change between batches, so a schedule belongs to one. Without
     * this, setting batch 10's start date would silently rewrite what batch 9's
     * students were told.
     */
    tb_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    /** The day the student is told to turn up. */
    cs_start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    /**
     * Free text on purpose - "Monday to Friday", "Saturday & Sunday",
     * "Mon/Wed/Fri". Centres describe their week in ways a fixed set of
     * checkboxes would fight with, and this string is only ever read by a
     * person.
     */
    cs_class_days: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    /** Also free text: "09:00 AM" reads better in an email than "09:00:00". */
    cs_start_time: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    cs_end_time: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    /** Anything else the student needs on day one - a room, a gate, a contact. */
    cs_note: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
  },
  {
    tableName: "class_schedules",
    timestamps: true,
    indexes: [
      // One schedule per class. Two would mean two different answers to
      // "when does it start", and the email would pick one at random.
      {
        unique: true,
        fields: ["center_id", "course_id", "tb_id"],
        name: "class_schedules_center_course_batch",
      },
    ],
  }
);

module.exports = ClassSchedule;
