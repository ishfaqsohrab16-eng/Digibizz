const { Op } = require("sequelize");
const TrainerCenterAllocation = require("../models/trainersCenterAllocationModel");
const CentersDates = require("../models/centersDatesModel");
const { weekOf, isoDate, recentWeeks } = require("./evaluationWeek");

/**
 * Who a Master Trainer reports on, and over which weeks.
 *
 * THE MT-TO-TRAINER LINK IS THE COURSE, NOT A COLUMN ON THE TRAINER.
 *
 * A Master Trainer owns a course (mastertrainers.mt_course_id). A trainer is
 * theirs when that trainer is teaching that course. trainers.mt_id exists and
 * looks like the answer, but it is not the one the programme runs on: MTs are
 * organised by subject, and a trainer teaching Graphic Design is the Graphic
 * Design MT's to evaluate whether or not anybody set that column.
 *
 * WHICH IS DECIDED PER BATCH, from the allocation. trainers_center_allocation
 * is the record of who teaches what, where, in which batch - so one query
 * answers three questions at once: is this trainer teaching the MT's course,
 * are they teaching it in this batch, and do they have a class at all. A
 * trainer with no allocation simply never appears, which is what makes
 * "no class assigned" impossible to see here rather than something to filter.
 *
 * AND THE WEEKS COME FROM THE CENTRE'S DATES. centers_dates holds a start and
 * an end per centre per batch, which is the real teaching period. Offering
 * weeks outside it would invite a report on a week nobody taught - the columns
 * would be five days of nothing and a Master Trainer would have to sign for it.
 */

/**
 * The trainers a Master Trainer evaluates in one batch.
 *
 * Returns their ids and the classes each is teaching in that batch. Distinct
 * by trainer: a trainer with three classes is one person and gets one report.
 */
const trainersForCourse = async (courseId, tb_id) => {
  if (!courseId || !tb_id) return [];

  const rows = await TrainerCenterAllocation.findAll({
    where: { course_id: courseId, tb_id },
    attributes: ["t_id", "center_id", "course_id", "tb_id"],
    raw: true,
  });

  const byTrainer = new Map();
  for (const row of rows) {
    if (!byTrainer.has(row.t_id)) byTrainer.set(row.t_id, []);
    byTrainer.get(row.t_id).push({
      center_id: Number(row.center_id),
      course_id: Number(row.course_id),
      tb_id: Number(row.tb_id),
    });
  }

  return [...byTrainer.entries()].map(([t_id, classes]) => ({ t_id: Number(t_id), classes }));
};

/** The classes one trainer teaches in one batch. */
const classesInBatch = async (t_id, tb_id) => {
  if (!t_id || !tb_id) return [];

  const rows = await TrainerCenterAllocation.findAll({
    where: { t_id, tb_id },
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
 * When teaching actually runs, per centre and overall.
 *
 * EVERY CENTRE HAS ITS OWN DATES, even within one batch - centres start when
 * they are ready, so Batch 10 at BUITEMS and Batch 10 at UoB are not the same
 * ten weeks. That is why this returns `byCentre` as well as an overall span,
 * and why the two are used for different things:
 *
 *   `overall` decides which weeks may be reported on at all. It is the widest
 *   of the centres, because a week EITHER centre was teaching in is a week
 *   worth a report.
 *
 *   `byCentre` decides what that report covers. In the first week of a batch
 *   one centre may have started and the other not, and asking a Master Trainer
 *   to grade a class that had not begun is asking them to make something up.
 *
 * Returns null overall when no centre has dates recorded. That is a real state
 * - somebody has not filled the calendar in - and the caller has to say so
 * rather than silently offering every week since January.
 */
const teachingWindow = async (centerIds, tb_id) => {
  if (!tb_id || !centerIds?.length) return null;

  const rows = await CentersDates.findAll({
    where: { tb_id, center_id: { [Op.in]: centerIds } },
    attributes: ["center_id", "tb_start", "tb_end"],
    raw: true,
  });

  const byCentre = {};
  const starts = [];
  const ends = [];

  for (const row of rows) {
    const start = new Date(row.tb_start);
    const end = new Date(row.tb_end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;

    byCentre[row.center_id] = { start: isoDate(start), end: isoDate(end) };
    starts.push(start.getTime());
    ends.push(end.getTime());
  }

  if (starts.length === 0) return null;

  return {
    start: isoDate(new Date(Math.min(...starts))),
    end: isoDate(new Date(Math.max(...ends))),
    byCentre,
  };
};

/**
 * Which of a trainer's classes were actually running in a given week.
 *
 * A class whose centre had not started, or had already finished, is marked
 * inactive rather than dropped: the report should say "UoB had not started
 * yet" instead of quietly omitting a class the reader knows exists.
 *
 * A centre with no dates recorded counts as running. Being absent from the
 * calendar is a gap in the calendar, not evidence that nobody taught, and
 * hiding a real class over it would be the worse mistake.
 */
const classesActiveIn = (classes, week, window) =>
  (classes || []).map((entry) => {
    const dates = window?.byCentre?.[entry.center_id];
    if (!dates) return { ...entry, active: true, dates: null };

    return {
      ...entry,
      active: week.start <= dates.end && week.end >= dates.start,
      dates,
    };
  });

/**
 * The weeks a report may be filed for, newest first.
 *
 * Every week that OVERLAPS the teaching window, not only those wholly inside
 * it. A centre starting on a Wednesday still taught three days that week, and
 * that week needs a report; requiring the whole week to fall inside the window
 * would silently drop the first and last weeks of every batch.
 *
 * Never past this week either - a report filed in advance is a guess with two
 * signatures on it.
 */
const weeksInWindow = (window, now = new Date(), limit = 60) => {
  if (!window) return [];

  const thisMonday = weekOf(now).start;
  const weeks = [];

  for (const week of recentWeeks(limit, now)) {
    // Past the end of teaching, or not started yet.
    if (week.start > window.end) continue;
    if (week.end < window.start) break;
    if (week.start > thisMonday) continue;

    weeks.push(week);
  }

  return weeks;
};

/** Is this a week the batch was actually teaching in? */
const isInWindow = (week, window) => {
  if (!week || !window) return false;
  return week.start <= window.end && week.end >= window.start;
};

module.exports = {
  trainersForCourse,
  classesInBatch,
  teachingWindow,
  classesActiveIn,
  weeksInWindow,
  isInWindow,
};
