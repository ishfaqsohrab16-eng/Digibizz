const { Op } = require("sequelize");
const TrainerCenterAllocation = require("../models/trainersCenterAllocationModel");
const Center = require("../models/center");
const Course = require("../models/course");
const { teachingWindow, isInWindow } = require("./evaluationScope");
const { isOnlineMedium } = require("./centerMedium");

/**
 * Which online and hybrid centres need an Online Classes Report, for one batch
 * and one week.
 *
 * The same test the rest of the M&E module applies, one centre at a time:
 *
 *   SOMEBODY IS ALLOCATED TO TEACH THERE in this batch. A centre with no class
 *   has nothing to report on.
 *
 *   IT IS ONLINE OR HYBRID. Physical centres are reported per trainer instead.
 *
 *   ITS OWN DATES COVER THIS WEEK. Centres in one batch keep their own
 *   calendars; a centre that has not opened yet is not on the list. A centre
 *   with no dates recorded counts as running - a gap in the calendar is not
 *   evidence that nobody taught, and dropping a real centre over it would mean
 *   nobody reports on it and nobody notices.
 *
 * Each centre comes with the courses taught there, because the report has one
 * row of daily counts per course.
 *
 * Kept separate from utils/visitScope.js on purpose. Centre visits fold every
 * online centre into one "Online Cell"; this report is one per centre. Two
 * different questions, and sharing the code would couple them.
 */
const onlineCentersFor = async (tb_id, week) => {
  if (!tb_id || !week) return [];

  const allocations = await TrainerCenterAllocation.findAll({
    where: { tb_id },
    attributes: ["center_id", "course_id"],
    raw: true,
  });
  if (allocations.length === 0) return [];

  const centerIds = [...new Set(allocations.map((row) => Number(row.center_id)))];

  const centers = await Center.findAll({
    where: { center_id: { [Op.in]: centerIds } },
    attributes: ["center_id", "center_name", "center_medium"],
    raw: true,
  });

  const online = centers.filter((center) => isOnlineMedium(center.center_medium));
  if (online.length === 0) return [];

  const onlineIds = new Set(online.map((center) => Number(center.center_id)));
  const window = await teachingWindow([...onlineIds], tb_id);

  // Courses per online centre, distinct: a class allocated twice is still one
  // row of counts.
  const coursesAt = new Map();
  for (const row of allocations) {
    const centerId = Number(row.center_id);
    if (!onlineIds.has(centerId)) continue;
    if (!coursesAt.has(centerId)) coursesAt.set(centerId, new Set());
    coursesAt.get(centerId).add(Number(row.course_id));
  }

  const allCourseIds = [...new Set([...coursesAt.values()].flatMap((set) => [...set]))];
  const courses = allCourseIds.length
    ? await Course.findAll({
        where: { course_id: { [Op.in]: allCourseIds } },
        attributes: ["course_id", "course_name", "course_full_name"],
        raw: true,
      })
    : [];
  const courseName = Object.fromEntries(
    courses.map((course) => [
      Number(course.course_id),
      course.course_full_name || course.course_name,
    ])
  );

  return online
    .filter((center) => {
      const dates = window?.byCentre?.[center.center_id];
      return !dates || isInWindow(week, dates);
    })
    .map((center) => ({
      center_id: Number(center.center_id),
      center_name: center.center_name,
      medium: center.center_medium,
      dates: window?.byCentre?.[center.center_id] || null,
      courses: [...(coursesAt.get(Number(center.center_id)) || [])]
        .map((course_id) => ({
          course_id,
          course_name: courseName[course_id] || `Course ${course_id}`,
        }))
        .sort((a, b) => a.course_name.localeCompare(b.course_name)),
    }))
    .sort((a, b) => a.center_name.localeCompare(b.center_name));
};

/**
 * One centre, checked against the list rather than trusted from the request.
 *
 * A centre id in a request body is a number the browser chose. Resolving it
 * here means a report can only ever be filed for an online or hybrid centre
 * that really had a class running that week.
 */
const onlineCenterFor = async (tb_id, week, centerId) => {
  const centers = await onlineCentersFor(tb_id, week);
  return centers.find((center) => center.center_id === Number(centerId)) || null;
};

module.exports = { onlineCentersFor, onlineCenterFor };
