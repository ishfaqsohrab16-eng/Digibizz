const { Op } = require("sequelize");
const { sequelize } = require("../config/db");
const TrainerCenterAllocation = require("../models/trainersCenterAllocationModel");
const DailyLectureReport = require("../models/dailyLectureReport");
const Assignment = require("../models/assignmentModel");
const StudentQuiz = require("../models/StudentQuiz");
const Student = require("../models/studentModel");
const StudentLeave = require("../models/studentLeaveModel");

/**
 * The figures the LMS can answer for itself on a weekly M&E report.
 *
 * The Master Trainer signs the form, so every number here is a STARTING POINT
 * they may correct - they were at the centre and the database was not. What
 * this removes is the counting, which is the part nobody does accurately from
 * memory on a Friday afternoon.
 *
 * Each figure carries a `source`, and the form shows it. "Counted from the
 * lecture reports" and "nothing in the system records this" are different
 * kinds of blank, and an MT who cannot tell them apart will either distrust a
 * good number or accept a missing one.
 *
 * SCOPE is every class the trainer is allocated to. A trainer with three
 * classes gets one report covering all three, so every count spans them.
 *
 * DATES: dlr_date, sl_date and quiz_created_on are stored as 'YYYY-MM-DD'
 * strings rather than DATEs. Compared as strings, which is exact for that
 * format and needs no per-row casting - and is why the format is asserted in
 * the tests rather than assumed here.
 */

/** How a figure was arrived at, for the label beside it on the form. */
const SOURCE = {
  COUNTED: "counted",
  AUDIT: "audit",
  UNAVAILABLE: "unavailable",
};

const figure = (value, source, note) => ({ value, source, note });

/** The classes a trainer is allocated to teach. */
const classesFor = async (t_id) => {
  const rows = await TrainerCenterAllocation.findAll({
    where: { t_id },
    attributes: ["center_id", "course_id", "tb_id"],
    raw: true,
  });

  return rows.map((row) => ({
    center_id: Number(row.center_id),
    course_id: Number(row.course_id),
    tb_id: Number(row.tb_id),
  }));
};

/**
 * A WHERE that matches students of any of these classes.
 *
 * Built as an OR of exact (centre, course, batch) triples, NOT as three
 * separate IN lists. A trainer teaching Graphic Design at BUITEMS and Digital
 * Marketing at UoB does not teach Digital Marketing at BUITEMS, and the cross
 * product would quietly count a colleague's students as theirs.
 */
const classScope = (classes) => {
  if (classes.length === 0) return null;

  return {
    [Op.or]: classes.map((entry) => ({
      center_id: entry.center_id,
      course_id: entry.course_id,
      tb_id: entry.tb_id,
    })),
  };
};

/**
 * Which of the five teaching days have a lecture report from this trainer.
 *
 * The one daily criterion the system can answer. Returned per day so the grid
 * can be ticked in advance and the MT only has to correct it.
 */
const lectureReportDays = async (t_id, week) => {
  const rows = await DailyLectureReport.findAll({
    where: {
      t_id,
      dlr_date: { [Op.between]: [week.start, week.end] },
    },
    attributes: ["dlr_date"],
    raw: true,
  });

  // A trainer with three classes files three reports for one day. The question
  // is whether the day was reported at all, so they collapse to a set.
  const reported = new Set(rows.map((row) => String(row.dlr_date).slice(0, 10)));

  const byDay = {};
  for (const day of week.days) byDay[day.key] = reported.has(day.date);

  return byDay;
};

/** Assignments this trainer set during the week. */
const assignmentCount = (t_id, week) =>
  Assignment.count({
    where: {
      t_id,
      // as_added_on is a real DATETIME, so the day itself has to be included
      // up to its last moment or everything set on Friday is missed.
      as_added_on: { [Op.between]: [`${week.start} 00:00:00`, `${week.end} 23:59:59`] },
    },
  });

/** Quizzes this trainer created during the week. */
const quizCount = (t_id, week) =>
  StudentQuiz.count({
    where: {
      t_id,
      quiz_created_on: { [Op.between]: [week.start, week.end] },
    },
  });

/**
 * Students enrolled in these classes before the week began.
 *
 * "In the start of the week" on the paper form. Counted as those added before
 * Monday and not since removed - the closest the schema allows, because
 * students.std_lms_status records THAT a student was removed and not WHEN.
 * A student removed mid-week is therefore missing from this count although
 * they were present on Monday, which is why the figure stays editable and the
 * note says so.
 */
const enrolledAtStart = async (classes, week) => {
  const scope = classScope(classes);
  if (!scope) return 0;

  return Student.count({
    where: {
      ...scope,
      std_added_on: { [Op.lt]: `${week.start} 00:00:00` },
      std_lms_status: { [Op.ne]: 2 },
    },
  });
};

/** Students enrolled into these classes during the week. */
const newlyEnrolled = async (classes, week) => {
  const scope = classScope(classes);
  if (!scope) return 0;

  return Student.count({
    where: {
      ...scope,
      std_added_on: { [Op.between]: [`${week.start} 00:00:00`, `${week.end} 23:59:59`] },
    },
  });
};

/**
 * Students who left these classes during the week.
 *
 * There is no leaving date on a student: std_lms_status becomes 2 and the
 * previous value is gone. The audit log is the only record of WHEN, so this
 * counts changes it recorded that set that column to 2.
 *
 * That makes it the least certain figure on the form. It sees nothing from
 * before audit logging was switched on, nothing done directly in the database,
 * and nothing from the period when audit writes were failing on their own
 * NOT NULL constraint. Reported as `audit` rather than `counted` for exactly
 * that reason, and always editable.
 */
const dropouts = async (classes, week) => {
  if (classes.length === 0) return 0;

  const [rows] = await sequelize.query(
    `SELECT COUNT(DISTINCT a.act_entity_id) AS total
       FROM activity_log a
       JOIN students s ON s.std_id = a.act_entity_id
      WHERE a.act_entity = 'Student'
        AND a.act_on >= :start
        AND a.act_on < :afterEnd
        AND a.act_changes LIKE '%"field":"std_lms_status"%'
        AND a.act_changes LIKE '%"to":2%'
        AND (${classes
          .map(
            (_, index) =>
              `(s.center_id = :center${index} AND s.course_id = :course${index} AND s.tb_id = :batch${index})`
          )
          .join(" OR ")})`,
    {
      replacements: {
        start: `${week.start} 00:00:00`,
        // Exclusive upper bound on the day AFTER Friday, so a removal at
        // 23:59:59.400 on Friday is inside the week rather than rounded out.
        afterEnd: nextDay(week.end),
        ...Object.fromEntries(
          classes.flatMap((entry, index) => [
            [`center${index}`, entry.center_id],
            [`course${index}`, entry.course_id],
            [`batch${index}`, entry.tb_id],
          ])
        ),
      },
    }
  );

  return Number(rows?.[0]?.total) || 0;
};

/** The day after an ISO date, as 'YYYY-MM-DD 00:00:00'. */
const nextDay = (isoDay) => {
  const date = new Date(`${isoDay}T00:00:00`);
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day} 00:00:00`;
};

/**
 * Students on approved leave during the week.
 *
 * DISTINCT students, not leave records: three days off is one student on
 * leave, and counting the rows would report three. sl_status 1 is approved;
 * a pending request is not yet an absence anyone agreed to.
 */
const onLeave = async (classes, week) => {
  const scope = classScope(classes);
  if (!scope) return 0;

  const rows = await StudentLeave.findAll({
    where: {
      ...scope,
      sl_status: 1,
      sl_date: { [Op.between]: [week.start, week.end] },
    },
    attributes: ["std_cnic"],
    raw: true,
  });

  return new Set(rows.map((row) => row.std_cnic)).size;
};

/**
 * Everything the LMS can say about one trainer's week.
 *
 * Read in parallel: they are independent, and an MT opening a form should not
 * wait for seven round trips in sequence.
 */
const metricsFor = async (t_id, week) => {
  const classes = await classesFor(t_id);

  const [lectureDays, assignments, quizzes, enrolled, joined, left, leave] = await Promise.all([
    lectureReportDays(t_id, week),
    assignmentCount(t_id, week),
    quizCount(t_id, week),
    enrolledAtStart(classes, week),
    newlyEnrolled(classes, week),
    dropouts(classes, week).catch((error) => {
      // The audit query is the one that reaches outside the models. If the log
      // table is missing or shaped differently, the rest of the form is still
      // worth filling in.
      console.warn(`[evaluation] could not count drop-outs: ${error.message}`);
      return null;
    }),
    onLeave(classes, week),
  ]);

  return {
    classes,
    lecture_reports: lectureDays,
    assignments: figure(assignments, SOURCE.COUNTED, "Assignments created this week"),
    quizzes: figure(quizzes, SOURCE.COUNTED, "Quizzes created this week"),
    enrolled_start: figure(
      enrolled,
      SOURCE.COUNTED,
      "Enrolled before Monday and not since removed"
    ),
    new_enrolled: figure(joined, SOURCE.COUNTED, "Enrolled during this week"),
    dropouts:
      left === null
        ? figure(null, SOURCE.UNAVAILABLE, "The activity log could not be read")
        : figure(left, SOURCE.AUDIT, "From the activity log - please confirm"),
    on_leave: figure(leave, SOURCE.COUNTED, "Students with approved leave this week"),
    mt_visit_date: figure(null, SOURCE.UNAVAILABLE, "Nothing in the system records MT visits"),
    quality: figure(null, SOURCE.UNAVAILABLE, "Your assessment"),
    feedback_submission: figure(null, SOURCE.UNAVAILABLE, "Your assessment"),
  };
};

module.exports = {
  metricsFor,
  classesFor,
  classScope,
  lectureReportDays,
  SOURCE,
  _internals: { nextDay, figure },
};
