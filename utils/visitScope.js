const { Op } = require("sequelize");
const Center = require("../models/center");
const TrainerCenterAllocation = require("../models/trainersCenterAllocationModel");
const CentersDates = require("../models/centersDatesModel");
const { ONLINE_CELL, isOnlineMedium } = require("./visitForm");
const { isInWindow } = require("./evaluationScope");
const { isoDate } = require("./evaluationWeek");

/**
 * Which centres need a visit this week.
 *
 * A Master Trainer visits every centre that has a class running. Three things
 * decide whether one does:
 *
 *   SOMEBODY IS ALLOCATED TO TEACH THERE in this batch. A centre with no class
 *   is a building, and visiting it would report on nothing.
 *
 *   ITS OWN DATES COVER THIS WEEK. Centres inside one batch start and finish
 *   on their own schedule, so a centre that has not opened yet is not on the
 *   list - a visit report about it would be a page of blanks.
 *
 * Online and hybrid centres are folded into a single Online Cell: nobody
 * travels to them, so one form covers them all and one Master Trainer files
 * it. It appears on the same terms as anything else - only while one of the
 * centres it covers still has a class running.
 */

/**
 * The centres to visit, for one batch and one week.
 *
 * Physical centres first, alphabetically, with the Online Cell last - it is a
 * different kind of thing and belongs at the end of the list rather than
 * sorted into the middle of the real places.
 */
const centersToVisit = async (tb_id, week) => {
  if (!tb_id || !week) return [];

  const allocations = await TrainerCenterAllocation.findAll({
    where: { tb_id },
    attributes: ["center_id"],
    raw: true,
  });

  const teachingIds = [...new Set(allocations.map((row) => Number(row.center_id)))];
  if (teachingIds.length === 0) return [];

  const [centers, dates] = await Promise.all([
    Center.findAll({
      where: { center_id: { [Op.in]: teachingIds } },
      attributes: ["center_id", "center_name", "center_medium", "center_status"],
      raw: true,
    }),
    CentersDates.findAll({
      where: { tb_id, center_id: { [Op.in]: teachingIds } },
      attributes: ["center_id", "tb_start", "tb_end"],
      raw: true,
    }),
  ]);

  const windowBy = {};
  for (const row of dates) {
    const start = new Date(row.tb_start);
    const end = new Date(row.tb_end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    windowBy[row.center_id] = { start: isoDate(start), end: isoDate(end) };
  }

  /**
   * A centre with no dates recorded counts as running.
   *
   * An absent record is a gap in the calendar, not evidence that nobody
   * taught. Dropping a real centre over a missing row would mean nobody
   * visits it and nobody notices.
   */
  const running = (centerId) => {
    const dates = windowBy[centerId];
    if (!dates) return true;
    return isInWindow(week, dates);
  };

  const physical = [];
  const folded = [];

  for (const center of centers) {
    if (!running(center.center_id)) continue;

    if (isOnlineMedium(center.center_medium)) {
      // Folded into the one Online Cell rather than listed separately.
      folded.push(center.center_name);
      continue;
    }

    physical.push({
      center_id: Number(center.center_id),
      center_name: center.center_name,
      medium: center.center_medium || "Physical",
      online_cell: false,
      dates: windowBy[center.center_id] || null,
    });
  }

  physical.sort((a, b) => a.center_name.localeCompare(b.center_name));

  /**
   * The Online Cell appears on exactly the same terms as a physical centre:
   * only while something it covers still has a class running.
   *
   * `folded` is empty when no online or hybrid centre is teaching this week -
   * either because none is allocated to this batch, or because their own dates
   * have not started or have finished - and in that case there is nothing to
   * report on and the entry is not offered at all.
   *
   * Which centres it covers travels with it, so a Master Trainer opening the
   * form knows what they are reporting on rather than guessing.
   */
  return folded.length > 0
    ? [
        ...physical,
        {
          center_id: ONLINE_CELL.id,
          center_name: ONLINE_CELL.name,
          medium: ONLINE_CELL.medium,
          online_cell: true,
          dates: null,
          covers: folded,
        },
      ]
    : physical;
};

/**
 * One centre, checked against the list rather than trusted from the request.
 *
 * A centre id in a request body is a number the browser chose. Resolving it
 * here means a visit can only ever be filed for a centre that genuinely had a
 * class running that week.
 */
const centerToVisit = async (tb_id, week, centerId) => {
  const centers = await centersToVisit(tb_id, week);
  return centers.find((entry) => entry.center_id === Number(centerId)) || null;
};

module.exports = { centersToVisit, centerToVisit };
