/**
 * The Online Classes Report: what a Master Trainer writes about one online or
 * hybrid centre for one week.
 *
 * Taken from the paper form. The first three answers are sentences, because
 * that is what the paper holds - "Lab attendant marks the attendance",
 * "Trainer is regularly taking classes" - and a yes/no would throw away the
 * part that says HOW. The fourth really is a yes or a no.
 *
 * The daily attendance counts per course are NOT answers. They come from the
 * register and are written by the server, so nobody types a number the LMS
 * could have counted - the same rule as the physical M&E report.
 */

const ONLINE_QUESTIONS = Object.freeze([
  {
    key: "students_attendance",
    label: "Students Attendance",
    kind: "text",
    hint: "How is attendance being taken? e.g. Lab attendant marks the attendance",
  },
  {
    key: "trainers_attendance",
    label: "Trainers Attendance",
    kind: "text",
    hint: "Is the trainer taking every class? e.g. Trainer is regularly taking classes",
  },
  {
    key: "lab_feedback",
    label: "Lab Feedback",
    kind: "text",
    hint: "How is the lab running? e.g. Lab attendants join the class on time",
  },
  {
    key: "mt_took_class",
    label: "MT took class in this week",
    kind: "yesno",
  },
]);

const TEXT_LIMIT = 500;

const yesNo = (value) =>
  value === true || value === "Yes" || value === "yes"
    ? "Yes"
    : value === false || value === "No" || value === "no"
      ? "No"
      : null;

/**
 * Keep only the questions the form defines, each in its expected shape.
 *
 * A key the form does not ask cannot be stored: it would sit in the database
 * looking like an answer to a question nobody was shown.
 */
const cleanAnswers = (raw) => {
  const source = raw && typeof raw === "object" ? raw : {};
  const answers = {};

  for (const question of ONLINE_QUESTIONS) {
    const value = source[question.key];
    if (question.kind === "yesno") {
      answers[question.key] = yesNo(value);
    } else {
      const text = String(value ?? "").trim();
      answers[question.key] = text ? text.slice(0, TEXT_LIMIT) : null;
    }
  }

  return answers;
};

/** The labels of the questions still unanswered - what submitting needs. */
const unanswered = (answers) =>
  ONLINE_QUESTIONS.filter((question) => !answers?.[question.key]).map(
    (question) => question.label
  );

module.exports = { ONLINE_QUESTIONS, TEXT_LIMIT, cleanAnswers, unanswered };
