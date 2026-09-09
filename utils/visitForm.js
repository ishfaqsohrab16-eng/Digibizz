/**
 * The Visit Report Proforma.
 *
 * A Master Trainer visits every centre with a class running, every week, and
 * fills one of these in per centre. The paper form lays its questions down the
 * side and the centres across the top - UOB, BUITEMS, GCC, ITTI, Online Cell -
 * which works on a clipboard and not on a screen: a visit happens at one
 * centre, at one time, with its own photographs. So it is one form per centre
 * here, and the questions are what the columns of the paper form share.
 *
 * TWO DIFFERENT RULES ABOUT WHO FILES WHAT, and they are the crux of this
 * module:
 *
 *   A PHYSICAL CENTRE is visited by EVERY Master Trainer, each filing their
 *   own report. They go on different days and see different things - one
 *   arrives to find the projector broken, another finds it fixed - and
 *   collapsing that into a single report would throw away the disagreement,
 *   which is the most informative part of it.
 *
 *   THE ONLINE CELL is filed ONCE, by whoever gets to it first. Every centre
 *   whose medium is Online or Hybrid folds into one virtual centre, because
 *   nobody travels to them and there is nothing to see twice.
 *
 * EVERY ANSWER IS YES, NO, AND A REMARK. The paper leaves a box per cell and
 * people write in it; a bare tick loses the reason. "Is the electricity
 * available during class?" answered No is a fact, and "No - load-shedding
 * 11am-1pm daily" is the thing somebody can act on.
 */

/**
 * The questions, in the order the paper form prints them.
 *
 * `key` is what is stored, and never depends on the order: rearranging the
 * form later must not re-map an answer onto a different question.
 */
const VISIT_QUESTIONS = [
  { key: "trainer_on_time", label: "Has the trainer reached on time?" },
  { key: "lab_attendant", label: "Is the Lab Attendant available?" },
  { key: "center_manager", label: "Is the Center Manager available?" },
  { key: "electricity", label: "Is the Electricity available during class?" },
  { key: "internet", label: "Is the Internet available during the class?" },
  { key: "projector", label: "Is the multimedia projector functional?" },
  { key: "complaints", label: "Any complaints or remarks?" },
];

/** The virtual centre that stands for every online and hybrid centre. */
const ONLINE_CELL = {
  id: 0,
  name: "Online Cell",
  medium: "Online",
};

/**
 * Is this centre part of the Online Cell?
 *
 * Online AND Hybrid. A hybrid centre has an online cohort that is taught the
 * same way, and splitting it across two forms would ask somebody to visit half
 * a class.
 */
const isOnlineMedium = (medium) =>
  ["online", "hybrid"].includes(String(medium || "").trim().toLowerCase());

/** A yes/no answer with the note that explains it. */
const cleanAnswer = (raw) => {
  const answer =
    raw?.answer === true || raw?.answer === "Yes" || raw?.answer === "yes"
      ? "Yes"
      : raw?.answer === false || raw?.answer === "No" || raw?.answer === "no"
        ? "No"
        : null;

  const note = String(raw?.note ?? "").trim();

  return { answer, note: note ? note.slice(0, 500) : null };
};

/**
 * Keep only the questions the form defines.
 *
 * A question the form does not ask cannot be stored: it would sit in the
 * record with nothing to render it, and a reader would never know it was
 * there.
 */
const cleanAnswers = (raw) => {
  const answers = {};
  for (const question of VISIT_QUESTIONS) {
    answers[question.key] = cleanAnswer(raw?.[question.key]);
  }
  return answers;
};

/**
 * Which questions still have no answer.
 *
 * Used only when submitting. A draft may be half-finished - that is what a
 * draft is for - but a visit report signed off with blanks is a form somebody
 * filled in without looking.
 */
const unanswered = (answers) =>
  VISIT_QUESTIONS.filter((question) => !answers?.[question.key]?.answer).map(
    (question) => question.label
  );

/**
 * Who a report belongs to, for the purpose of "one per week".
 *
 * The Master Trainer for a physical centre, so each of them files their own.
 * A shared sentinel for the Online Cell, so the first one filed is the only
 * one there can be.
 *
 * Stored in its own column and indexed with the centre, batch and week. The
 * alternative - two different unique constraints depending on a value in the
 * row - is not something a database can express, and enforcing it in the
 * application alone would race between two browser tabs.
 */
const SHARED_OWNER = 0;

const ownerFor = (center, mt_id) => (center?.online_cell ? SHARED_OWNER : Number(mt_id));

module.exports = {
  VISIT_QUESTIONS,
  ONLINE_CELL,
  SHARED_OWNER,
  ownerFor,
  isOnlineMedium,
  cleanAnswers,
  cleanAnswer,
  unanswered,
};
