/**
 * Tests for the Visit Report Proforma.
 *
 * Run with:  node utils/visitForm.test.js
 * Exits non-zero if any rule regresses. No database.
 *
 * A visit report is evidence that somebody went to a centre and looked. The
 * cases here are the ones where a form could come back looking complete and
 * say nothing - a blank stored as a No, an answer to a question the form does
 * not ask, a note that vanished.
 */
const {
  VISIT_QUESTIONS,
  ONLINE_CELL,
  isOnlineMedium,
  cleanAnswers,
  cleanAnswer,
  unanswered,
} = require("./visitForm");

let passed = 0;
let failed = 0;

const check = (name, condition, detail) => {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? `  ->  ${detail}` : ""}`);
  }
};

console.log("\nThe questions on the paper\n");

check("seven questions", VISIT_QUESTIONS.length === 7, String(VISIT_QUESTIONS.length));
check(
  "in the order the form prints them",
  VISIT_QUESTIONS[0].key === "trainer_on_time" && VISIT_QUESTIONS[5].key === "projector"
);
check("every one has a key and a label", VISIT_QUESTIONS.every((q) => q.key && q.label));
check(
  "keys are stable names, not positions",
  VISIT_QUESTIONS.every((q) => /^[a-z_]+$/.test(q.key))
);

console.log("\nAn answer is Yes, No, and why\n");

check("a yes", cleanAnswer({ answer: "Yes" }).answer === "Yes");
check("a no", cleanAnswer({ answer: "No" }).answer === "No");
check("a boolean true", cleanAnswer({ answer: true }).answer === "Yes");
check("a boolean false", cleanAnswer({ answer: false }).answer === "No");
check("lower case", cleanAnswer({ answer: "yes" }).answer === "Yes");

// The distinction the whole form rests on. A blank is NOT a No: "nobody
// checked whether there was electricity" and "there was no electricity" are
// different findings, and storing the first as the second invents a fault.
check("a blank is unanswered, not a No", cleanAnswer({}).answer === null);
check("nothing at all is unanswered", cleanAnswer(undefined).answer === null);
check("nonsense is unanswered", cleanAnswer({ answer: "maybe" }).answer === null);

// The note is the part somebody can act on. "No" is a fact; "No -
// load-shedding 11am to 1pm daily" is a thing that can be fixed.
check("the note is kept", cleanAnswer({ answer: "No", note: " no power " }).note === "no power");
check("an empty note is null, not an empty string", cleanAnswer({ answer: "Yes", note: "  " }).note === null);
check(
  "a very long note is cut to fit its column",
  cleanAnswer({ answer: "No", note: "x".repeat(900) }).note.length === 500
);

// A note without an answer still survives, because somebody typed it and
// throwing it away would lose the only thing they said.
check("a note with no answer is kept", cleanAnswer({ note: "the door was locked" }).note === "the door was locked");

console.log("\nThe whole form\n");

const answers = cleanAnswers({
  trainer_on_time: { answer: "Yes" },
  electricity: { answer: "No", note: "load-shedding" },
  // A question the form does not ask, from a stale tab or a hand-written
  // request. Stored, it would sit in the record with nothing to render it.
  invented: { answer: "Yes" },
});

check("every question is present", Object.keys(answers).length === 7);
check("an invented question is dropped", answers.invented === undefined);
check("an answered one is kept", answers.trainer_on_time.answer === "Yes");
check("with its note", answers.electricity.note === "load-shedding");

// A question nobody touched comes back as an explicit blank rather than being
// absent, so the form renders every row whatever was sent.
check("an untouched question is present and blank", answers.projector.answer === null);

console.log("\nWhat is still missing\n");

check("a blank form is all seven", unanswered(cleanAnswers({})).length === 7);
check(
  "a partly filled one names what is left",
  unanswered(answers).length === 5,
  String(unanswered(answers).length)
);
check(
  "and names them as the questions people read",
  unanswered(answers).includes("Is the multimedia projector functional?"),
  unanswered(answers).join(" | ")
);

const complete = cleanAnswers(
  Object.fromEntries(VISIT_QUESTIONS.map((q) => [q.key, { answer: "Yes" }]))
);
check("a complete form has nothing missing", unanswered(complete).length === 0);
check("nothing at all is all seven missing", unanswered(undefined).length === 7);

console.log("\nThe Online Cell\n");

// Online AND hybrid. A hybrid centre has an online cohort taught the same way,
// and splitting it across two forms would ask somebody to visit half a class.
check("online is in it", isOnlineMedium("Online"));
check("hybrid is too", isOnlineMedium("Hybrid"));
check("physical is not", !isOnlineMedium("Physical"));
check("casing does not matter", isOnlineMedium("  online  "));
check("an unset medium is not online", !isOnlineMedium(null));
check("nor an empty one", !isOnlineMedium(""));

// Zero, so it can never collide with a real centre id.
check("the Online Cell is centre 0", ONLINE_CELL.id === 0);
check("and is named", ONLINE_CELL.name === "Online Cell");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
