const { attendanceByDay } = require("./evaluationMetrics");

/**
 * The register, per course, per day of the report week, at one online centre.
 *
 * The paper form has a row of daily attendance counts for every course taught
 * at the centre - Digital Marketing 19, 25, 24, 26, 24. Those are counted
 * here from the attendance table rather than typed in, through the same
 * attendanceByDay the physical M&E report uses, so the two reports cannot
 * count "present" differently.
 *
 * Each day carries P, A and L, and `marked` - whether any register was taken
 * that day. A day nobody marked is not a day nobody came, and the form shows
 * the two differently.
 */
const attendanceByCourse = async (center, tb_id, week) =>
  Promise.all(
    (center?.courses || []).map(async (course) => ({
      course_id: course.course_id,
      course_name: course.course_name,
      days: await attendanceByDay(
        [{ center_id: center.center_id, course_id: course.course_id, tb_id }],
        week
      ),
    }))
  );

module.exports = { attendanceByCourse };
