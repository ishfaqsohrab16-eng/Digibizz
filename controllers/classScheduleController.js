const { Op, fn, col } = require("sequelize");
const ClassSchedule = require("../models/classScheduleModel");
const Candidate = require("../models/CandidateModel");
const Student = require("../models/studentModel");
const Center = require("../models/center");
const Course = require("../models/course");

/**
 * The class schedule panel.
 *
 * Answers one question for whoever is about to enrol a batch: for every class
 * in it, when does teaching start and at what times? Enrolment quotes these
 * values in the email it sends the student, so a class without them cannot be
 * enrolled into - and the screen has to make the gaps obvious rather than
 * leaving somebody to discover them one failed enrolment at a time.
 *
 * So the list is not "the schedules that exist". It is every class in the batch,
 * each with its schedule or a visible hole where one should be.
 */

const TIME_MAX = 40;
const DAYS_MAX = 120;
const NOTE_MAX = 500;

const trimmed = (value) => String(value ?? "").trim();

/** A date the database will accept, and that a person actually typed. */
const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(trimmed(value)) &&
  !Number.isNaN(new Date(`${trimmed(value)}T00:00:00`).getTime());

/**
 * Validate a submitted schedule.
 *
 * Returns an error message, or null. Every field here ends up in an email to an
 * applicant who will travel to a centre on the strength of it, so "roughly
 * filled in" is not good enough - but the times and days are free text, because
 * centres describe their week in ways a fixed vocabulary would fight with.
 */
const validate = (body) => {
  if (!body.center_id) return "Choose a centre";
  if (!body.course_id) return "Choose a course";
  if (!body.tb_id) return "Choose a training batch";

  if (!isValidDate(body.cs_start_date)) {
    return "Enter the class start date as YYYY-MM-DD";
  }
  if (!trimmed(body.cs_class_days)) {
    return "Enter the class days, for example \"Monday to Friday\"";
  }
  if (!trimmed(body.cs_start_time)) return "Enter the class start time";
  if (!trimmed(body.cs_end_time)) return "Enter the class end time";

  if (trimmed(body.cs_class_days).length > DAYS_MAX) {
    return `Keep the class days under ${DAYS_MAX} characters`;
  }
  if (
    trimmed(body.cs_start_time).length > TIME_MAX ||
    trimmed(body.cs_end_time).length > TIME_MAX
  ) {
    return `Keep each time under ${TIME_MAX} characters`;
  }
  if (trimmed(body.cs_note).length > NOTE_MAX) {
    return `Keep the note under ${NOTE_MAX} characters`;
  }

  return null;
};

/**
 * Every class in a batch, whether or not it has a schedule.
 *
 * A class is a (centre, course) pair that somebody is in or is about to be in,
 * so it is derived from the candidates and students of the batch rather than
 * from a list of courses - a course nobody applied to at a centre is not a
 * class, and cluttering the panel with it would bury the rows that matter.
 */
exports.listSchedules = async (req, res) => {
  try {
    const tb_id = req.params.tb_id || req.query.tb_id;
    if (!tb_id) {
      return res
        .status(400)
        .json({ success: false, message: "A training batch is required" });
    }

    const [candidateClasses, studentClasses, schedules, centers, courses] =
      await Promise.all([
        Candidate.findAll({
          where: { tb_id },
          attributes: [
            [fn("DISTINCT", col("center_id")), "center_id"],
            "course_id",
          ],
          group: ["center_id", "course_id"],
          raw: true,
        }),
        Student.findAll({
          where: { tb_id },
          attributes: ["center_id", "course_id"],
          group: ["center_id", "course_id"],
          raw: true,
        }),
        ClassSchedule.findAll({ where: { tb_id } }),
        Center.findAll({ attributes: ["center_id", "center_name"], raw: true }),
        Course.findAll({
          attributes: ["course_id", "course_name", "course_full_name"],
          raw: true,
        }),
      ]);

    const centerName = new Map(centers.map((c) => [String(c.center_id), c.center_name]));
    const courseName = new Map(
      courses.map((c) => [
        String(c.course_id),
        c.course_full_name || c.course_name,
      ])
    );

    const byKey = new Map();
    const add = (center_id, course_id) => {
      if (!center_id || !course_id) return;
      byKey.set(`${center_id}|${course_id}`, {
        center_id: Number(center_id),
        course_id: Number(course_id),
      });
    };

    for (const row of candidateClasses) add(row.center_id, row.course_id);
    for (const row of studentClasses) add(row.center_id, row.course_id);
    // A schedule entered for a class that has since lost all its candidates
    // still belongs on the screen - otherwise it becomes invisible and
    // un-editable rather than obviously stale.
    for (const row of schedules) add(row.center_id, row.course_id);

    const scheduleByKey = new Map(
      schedules.map((row) => [`${row.center_id}|${row.course_id}`, row])
    );

    const classes = [...byKey.entries()]
      .map(([key, entry]) => {
        const schedule = scheduleByKey.get(key);
        return {
          ...entry,
          tb_id: Number(tb_id),
          center_name: centerName.get(String(entry.center_id)) || `Centre ${entry.center_id}`,
          course_name: courseName.get(String(entry.course_id)) || `Course ${entry.course_id}`,
          schedule: schedule
            ? {
                cs_id: schedule.cs_id,
                cs_start_date: schedule.cs_start_date,
                cs_class_days: schedule.cs_class_days,
                cs_start_time: schedule.cs_start_time,
                cs_end_time: schedule.cs_end_time,
                cs_note: schedule.cs_note,
              }
            : null,
        };
      })
      // Missing schedules first: they are the reason to open this screen.
      .sort((a, b) => {
        if (Boolean(a.schedule) !== Boolean(b.schedule)) return a.schedule ? 1 : -1;
        return (
          a.center_name.localeCompare(b.center_name) ||
          a.course_name.localeCompare(b.course_name)
        );
      });

    return res.json({
      success: true,
      tb_id: Number(tb_id),
      classes,
      missing: classes.filter((entry) => !entry.schedule).length,
    });
  } catch (error) {
    console.error("Class schedule list error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error loading class schedules" });
  }
};

/**
 * Create or update the schedule for one class.
 *
 * An upsert rather than separate create and update endpoints: the screen edits
 * a grid of classes, some of which have a row and some of which do not, and
 * making the browser track which is which is how you get a duplicate.
 */
exports.saveSchedule = async (req, res) => {
  try {
    const problem = validate(req.body);
    if (problem) {
      return res.status(400).json({ success: false, message: problem });
    }

    const where = {
      center_id: req.body.center_id,
      course_id: req.body.course_id,
      tb_id: req.body.tb_id,
    };

    const values = {
      ...where,
      cs_start_date: trimmed(req.body.cs_start_date),
      cs_class_days: trimmed(req.body.cs_class_days),
      cs_start_time: trimmed(req.body.cs_start_time),
      cs_end_time: trimmed(req.body.cs_end_time),
      cs_note: trimmed(req.body.cs_note) || null,
    };

    const existing = await ClassSchedule.findOne({ where });
    let schedule;
    if (existing) {
      schedule = await existing.update(values);
    } else {
      schedule = await ClassSchedule.create(values);
    }

    console.log(
      `[schedule] centre ${where.center_id} / course ${where.course_id} / batch ${where.tb_id} ` +
        `set to start ${values.cs_start_date} ${values.cs_start_time}-${values.cs_end_time} ` +
        `by user ${req.user?.id}`
    );

    return res.json({
      success: true,
      message: existing ? "Schedule updated" : "Schedule saved",
      schedule,
    });
  } catch (error) {
    console.error("Class schedule save error:", error);
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "A schedule already exists for this centre, course and batch",
      });
    }
    return res
      .status(500)
      .json({ success: false, message: "Server error saving the schedule" });
  }
};

/**
 * Remove a schedule.
 *
 * Enrolment then refuses that class again, which is the point: deleting is how
 * you stop enrolments while a start date is being reconsidered.
 */
exports.deleteSchedule = async (req, res) => {
  try {
    const schedule = await ClassSchedule.findByPk(req.params.cs_id);
    if (!schedule) {
      return res.status(404).json({ success: false, message: "Schedule not found" });
    }

    await schedule.destroy();
    return res.json({ success: true, message: "Schedule removed" });
  } catch (error) {
    console.error("Class schedule delete error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error removing the schedule" });
  }
};

/**
 * The schedule enrolment needs, or null.
 *
 * Exported rather than duplicated so the enrolment path and this panel can
 * never disagree about which row applies to a class.
 */
exports.findScheduleFor = async (center_id, course_id, tb_id, transaction) =>
  ClassSchedule.findOne({
    where: { center_id, course_id, tb_id },
    transaction,
  });

exports._internals = { validate, isValidDate };
