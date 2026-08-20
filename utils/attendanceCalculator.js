const Attendance = require("../models/attendanceModel");

/**
 * Single source of truth for attendance percentages.
 *
 * Before this module there were three different formulas (dashboard, attendance
 * history, attendance summary) that disagreed with each other, so the same
 * student could show three different numbers depending on the screen.
 *
 * The agreed rules:
 *
 *  1. The clock starts at the student's FIRST marked attendance for that
 *     class (center + course + batch) - not the batch start and not their LMS
 *     signup date. An enrolled student is marked P, A or L every class day, so
 *     their first mark is the day they effectively joined the class.
 *  2. The window runs from that first mark through to the most recent day
 *     attendance was taken for the class. Nothing before the student's first
 *     mark is ever held against them.
 *  3. "L" (approved leave) counts as present - it must not hurt the student.
 *  4. A day where the class ran but this student has no record at all is a
 *     trainer data gap: it is skipped, not counted as absent, and reported
 *     separately as `unmarkedDays` so it can be found and fixed.
 *  5. Future-dated records are ignored.
 *
 * Rule 4 is a deliberate trade-off. It means a student marked on 3 of 12 class
 * days, all present, scores 100% rather than 25% - so `unmarkedDays` and
 * `classDaysSinceFirstMark` are reported alongside the percentage, and a high
 * `unmarkedDays` should be read as "records missing", not "good attendance".
 *
 * No schema changes are required. Because the attendance table has no unique
 * constraint and no timestamps, duplicate rows for the same student/date are
 * de-duplicated here by keeping the highest `attend_id` (auto-increment, so
 * the most recently inserted row wins). The previous code tried to do this
 * with `record.createdAt`, which is always undefined - the model sets
 * `timestamps: false` - so it silently kept an arbitrary row.
 */

/** Approved leave counts towards the numerator. Flip to false to exclude it. */
const LEAVE_COUNTS_AS_PRESENT = true;

const PRESENT = "P";
const ABSENT = "A";
const LEAVE = "L";

/** Normalise an attend_date (STRING column, sometimes a Date) to YYYY-MM-DD. */
const toDateKey = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, "0"),
      String(value.getDate()).padStart(2, "0"),
    ].join("-");
  }
  const text = String(value).trim();
  // Already YYYY-MM-DD (optionally with a time component).
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : toDateKey(parsed);
};

/** Today in the program's timezone, as YYYY-MM-DD. */
const todayKey = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });

const normaliseStatus = (status) => String(status || "").trim().toUpperCase();

/**
 * Collapse duplicate rows: one record per (std_cnic, date), highest attend_id.
 * @returns {Map<string, Map<string, string>>} cnic -> (dateKey -> status)
 */
const dedupeByStudentAndDate = (records) => {
  const winners = new Map(); // `${cnic}|${date}` -> { attend_id, status }
  const cutoff = todayKey();

  records.forEach((record) => {
    const dateKey = toDateKey(record.attend_date);
    if (!dateKey || dateKey > cutoff) return; // ignore unparseable/future dates

    const status = normaliseStatus(record.attend_status);
    if (![PRESENT, ABSENT, LEAVE].includes(status)) return; // "Not Set" etc.

    const key = `${record.std_cnic}|${dateKey}`;
    const current = winners.get(key);
    if (!current || Number(record.attend_id) > Number(current.attend_id)) {
      winners.set(key, { attend_id: record.attend_id, status, dateKey, cnic: record.std_cnic });
    }
  });

  const byStudent = new Map();
  winners.forEach(({ cnic, dateKey, status }) => {
    if (!byStudent.has(cnic)) byStudent.set(cnic, new Map());
    byStudent.get(cnic).set(dateKey, status);
  });
  return byStudent;
};

/**
 * Turn one student's (date -> status) map into their statistics.
 * @param {Map<string,string>} ownRecords
 * @param {string[]} classDates all dates the class was held, ascending
 */
const buildStats = (ownRecords, classDates) => {
  const empty = {
    firstMarkedDate: null,
    daysCounted: 0,
    present: 0,
    absent: 0,
    leave: 0,
    unmarkedDays: 0,
    classDaysSinceFirstMark: 0,
    percentage: 0,
  };

  if (!ownRecords || ownRecords.size === 0) return empty;

  const ownDates = [...ownRecords.keys()].sort();
  const firstMarkedDate = ownDates[0];

  let present = 0;
  let absent = 0;
  let leave = 0;

  ownDates.forEach((dateKey) => {
    switch (ownRecords.get(dateKey)) {
      case PRESENT:
        present += 1;
        break;
      case ABSENT:
        absent += 1;
        break;
      case LEAVE:
        leave += 1;
        break;
    }
  });

  const markedDays = ownDates.length;
  const credited = present + (LEAVE_COUNTS_AS_PRESENT ? leave : 0);

  // Denominator: the days this student was actually marked (rule 4). A class
  // day with no record for them is a trainer data gap, not an absence, so it
  // is excluded from the percentage rather than held against the student.
  //
  // `classDates` only contains days attendance was actually recorded for this
  // class, so holidays and non-teaching days never enter the window either.
  const daysCounted = markedDays;

  // The window itself is still measured, so the gaps stay visible: a student
  // with 100% over 3 marked days out of 12 class days is a records problem,
  // and unmarkedDays is what makes that findable.
  const classDaysSinceFirstMark = classDates.filter((d) => d >= firstMarkedDate).length;
  const unmarkedDays = Math.max(classDaysSinceFirstMark - markedDays, 0);

  return {
    firstMarkedDate,
    daysCounted,
    markedDays,
    present,
    absent,
    leave,
    unmarkedDays,
    classDaysSinceFirstMark,
    percentage: daysCounted > 0 ? Number(((credited / daysCounted) * 100).toFixed(2)) : 0,
  };
};

/**
 * Attendance statistics for every student of one class (center+course+batch).
 *
 * @param {object} scope
 * @param {number|string} scope.tb_id
 * @param {number|string} scope.center_id
 * @param {number|string} scope.course_id
 * @param {string[]} [scope.cnics] restrict the returned map to these students
 * @returns {Promise<{ byStudent: Map<string, object>, classDates: string[] }>}
 */
const getClassAttendanceStats = async ({ tb_id, center_id, course_id, cnics }) => {
  const where = { tb_id };
  if (center_id !== undefined && center_id !== null) where.center_id = center_id;
  if (course_id !== undefined && course_id !== null) where.course_id = course_id;

  const records = await Attendance.findAll({
    where,
    attributes: ["attend_id", "std_cnic", "attend_date", "attend_status"],
    raw: true,
  });

  const byStudentRecords = dedupeByStudentAndDate(records);

  // A "class day" is any date on which attendance was recorded for this class.
  // Holidays and non-teaching days never appear, so they are excluded for free.
  const classDates = [
    ...new Set(
      [...byStudentRecords.values()].flatMap((dateMap) => [...dateMap.keys()])
    ),
  ].sort();

  const wanted = cnics && cnics.length ? new Set(cnics.map(String)) : null;
  const byStudent = new Map();

  const targets = wanted ? [...wanted] : [...byStudentRecords.keys()];
  targets.forEach((cnic) => {
    byStudent.set(cnic, buildStats(byStudentRecords.get(cnic), classDates));
  });

  return { byStudent, classDates };
};

/**
 * Attendance statistics for a single student.
 * @returns {Promise<object>} see buildStats()
 */
const getStudentAttendanceStats = async ({ std_cnic, tb_id, center_id, course_id }) => {
  const { byStudent } = await getClassAttendanceStats({
    tb_id,
    center_id,
    course_id,
    cnics: [std_cnic],
  });
  return byStudent.get(String(std_cnic)) || buildStats(null, []);
};

/**
 * Day-by-day breakdown for one student, from their first marked day onward.
 * Powers the student-facing "My Attendance" calendar.
 */
const getStudentAttendanceTimeline = async ({ std_cnic, tb_id, center_id, course_id }) => {
  const where = { tb_id };
  if (center_id !== undefined && center_id !== null) where.center_id = center_id;
  if (course_id !== undefined && course_id !== null) where.course_id = course_id;

  const records = await Attendance.findAll({
    where,
    attributes: ["attend_id", "std_cnic", "attend_date", "attend_status"],
    raw: true,
  });

  const byStudentRecords = dedupeByStudentAndDate(records);
  const classDates = [
    ...new Set(
      [...byStudentRecords.values()].flatMap((dateMap) => [...dateMap.keys()])
    ),
  ].sort();

  const own = byStudentRecords.get(String(std_cnic));
  const stats = buildStats(own, classDates);

  const days = stats.firstMarkedDate
    ? classDates
        .filter((dateKey) => dateKey >= stats.firstMarkedDate)
        .map((dateKey) => ({
          date: dateKey,
          status: own.get(dateKey) || null, // null => class ran, student unmarked
        }))
    : [];

  return { ...stats, days };
};

module.exports = {
  getClassAttendanceStats,
  getStudentAttendanceStats,
  getStudentAttendanceTimeline,
  // exported for tests / reuse
  toDateKey,
  dedupeByStudentAndDate,
  buildStats,
  LEAVE_COUNTS_AS_PRESENT,
};
