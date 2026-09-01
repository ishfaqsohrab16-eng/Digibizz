/**
 * The rules of the assignment module, as plain functions.
 *
 * Kept out of the controllers so they can be tested without a database, and so
 * the same answer is given everywhere. Each of these was previously decided
 * inline, differently, in more than one place.
 */

/** A submission that has been made but not yet marked. */
const STATUS_SUBMITTED = 0;
/** Marked by the trainer. */
const STATUS_MARKED = 1;
/** Returned for rework. */
const STATUS_RETURNED = 2;

/**
 * The deadline as a moment, or null if there is not one.
 *
 * The null check is not defensive tidiness. `new Date(null)` is the epoch -
 * a perfectly valid date in 1970 - so an assignment with no deadline read as
 * long past and every attempt to hand work in was refused. Empty strings and
 * undefined behave the same way or worse.
 */
const parseDeadline = (deadline) => {
  if (deadline === null || deadline === undefined) return null;
  if (typeof deadline === "string" && deadline.trim() === "") return null;

  const at = new Date(deadline);
  return Number.isNaN(at.getTime()) ? null : at;
};

/**
 * Is the deadline past?
 *
 * The column is a string, so this parses defensively: an unparsable deadline
 * is treated as NOT past. Refusing a student's work because the date in the
 * database is malformed would punish them for somebody else's typo.
 */
const isPastDeadline = (deadline, now = new Date()) => {
  const at = parseDeadline(deadline);
  if (!at) return false;
  return now.getTime() > at.getTime();
};

/**
 * How long is left, in whole minutes. Negative once the deadline has passed,
 * null when there is no usable deadline.
 */
const minutesUntilDeadline = (deadline, now = new Date()) => {
  const at = parseDeadline(deadline);
  if (!at) return null;
  return Math.round((at.getTime() - now.getTime()) / 60000);
};

/**
 * Check a mark against what the assignment is out of.
 *
 * Returns an error message, or null. The column is a STRING(5), so without this
 * "abc" stores happily and every average built from it becomes NaN - and a mark
 * above the total silently produces percentages over 100.
 *
 * @param {*} value      what the trainer typed
 * @param {*} outOf      the assignment's as_marks
 */
const validateMark = (value, outOf) => {
  const text = String(value ?? "").trim();
  if (text === "") return null; // Clearing a mark is allowed.

  const mark = Number(text);
  if (!Number.isFinite(mark)) return "Marks must be a number";
  if (mark < 0) return "Marks cannot be negative";

  const total = Number(outOf);
  if (Number.isFinite(total) && total > 0 && mark > total) {
    return `Marks cannot be more than the assignment total (${total})`;
  }

  // STRING(5) in the database. Anything longer is silently truncated, which
  // turns 100.5 into "100.5" (fine) but 1000.25 into "1000." (not).
  if (text.length > 5) return "Marks must be 5 characters or fewer";

  return null;
};

/**
 * The average of the marks actually awarded.
 *
 * A zero IS a mark. The previous version filtered with `sub.obt_marks &&
 * parseFloat(...) > 0`, so every student who scored nothing was dropped from
 * the average - which quietly flattered every class it was shown for.
 *
 * Only submissions the trainer has actually marked are counted; an unmarked
 * submission has no mark to average.
 */
const averageMark = (submissions) => {
  const marked = (submissions || []).filter((submission) => {
    if (Number(submission.as_submission_status) !== STATUS_MARKED) return false;
    const mark = Number(submission.obt_marks);
    return Number.isFinite(mark);
  });

  if (marked.length === 0) return null;

  const total = marked.reduce(
    (sum, submission) => sum + Number(submission.obt_marks),
    0
  );
  return Number((total / marked.length).toFixed(2));
};

/**
 * What a trainer sees against one assignment.
 *
 * `pending` is clamped at zero: it was `totalStudents - submissionCount`, which
 * goes NEGATIVE whenever somebody submitted and then moved centre or was
 * removed from the batch, and "-2 pending" on a dashboard is worse than wrong,
 * it is confusing.
 */
const submissionStatistics = (submissions, totalStudents) => {
  const list = submissions || [];
  const total = Math.max(0, Number(totalStudents) || 0);

  const submissionCount = list.length;
  const markedCount = list.filter(
    (submission) => Number(submission.as_submission_status) === STATUS_MARKED
  ).length;

  return {
    totalStudents: total,
    submissionCount,
    markedCount,
    awaitingMarking: Math.max(0, submissionCount - markedCount),
    pendingCount: Math.max(0, total - submissionCount),
    avgMarks: averageMark(list),
  };
};

module.exports = {
  STATUS_SUBMITTED,
  STATUS_MARKED,
  STATUS_RETURNED,
  isPastDeadline,
  minutesUntilDeadline,
  validateMark,
  averageMark,
  submissionStatistics,
};
