/**
 * Tests for recovering a readable answer from a model that ignored the tool.
 *
 * Run with:  node utils/answerText.test.js
 * Exits non-zero if any rule regresses.
 *
 * The first case is the exact reply that reached a user's screen, reasoning
 * and invented XML and all. The rest are the ways that recovery could go
 * wrong - most importantly, by deleting the answer along with the noise.
 */
const { cleanAnswerText } = require("./answerText");

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

console.log("\nThe reply that actually reached a screen\n");

const REAL = `Okay, let me try to figure out what's going on here. The user asked for all details about student ID 56201, including assignments and attendance. I started by checking the students table, but the first query had an error because 'std_name' isn't a column there. So I adjusted to get the necessary fields from students, then tried to get the user's name from the user table by joining on user_id.

But all the queries returned no rows. That means there's no student with std_id 56201 in the database. Let me double-check the first query I ran: SELECT std_id FROM students WHERE std_id = 56201. Since that also returned nothing, it's clear the student doesn't exist.

I should make sure I didn't make any mistakes in the SQL syntax. Either way, the database has no records for this student ID. I need to inform the user clearly that the student doesn't exist and suggest verifying the ID.
</think>

<error>
The student with std_id 56201 does not exist in the database. All queries returned zero results, indicating no record matches this ID in students, user, assignments, attendance, or related tables. Please verify the student ID or check for possible typos.
</error>

<summary>
No data found for student ID 56201 - the database contains no records matching this identifier. All related tables (assignments, attendance, enrollment details) returned empty results. This could indicate an incorrect ID format, data entry error, or the student never being enrolled in the system.
</summary>

<visuals>
</visuals>`;

const real = cleanAnswerText(REAL);

check("the monologue is gone", !/let me try to figure out/i.test(real.summary), real.summary.slice(0, 80));
check("the dangling </think> is gone", !/<\/think>/i.test(real.summary));
check("no tags survive", !/[<>]/.test(real.summary), real.summary);
check(
  "the summary it wrote is what is shown",
  real.summary.startsWith("No data found for student ID 56201"),
  real.summary.slice(0, 80)
);
check("and it is complete", /never being enrolled in the system\.$/.test(real.summary));
check("an empty visuals block yields none", real.visuals.length === 0);

console.log("\nNot deleting the answer along with the noise\n");

// The failure that would be worse than the bug: a plain answer, mangled.
const plain = cleanAnswerText("Enrolment is highest at UoB with 1,335 students.");
check("an ordinary answer passes through untouched", plain.summary === "Enrolment is highest at UoB with 1,335 students.");

// Real prose contains angle brackets. Stripping them as tags would corrupt it.
const maths = cleanAnswerText("Every centre has < 200 female students, and A > B overall.");
check(
  "comparisons are not mistaken for tags",
  maths.summary === "Every centre has < 200 female students, and A > B overall.",
  maths.summary
);

const mail = cleanAnswerText("Contact <admin@digibizz.gob.pk> for access.");
check("an address in brackets survives", /admin@digibizz\.gob\.pk/.test(mail.summary), mail.summary);

check("empty input is empty output", cleanAnswerText("").summary === "");
check("null is handled", cleanAnswerText(null).summary === "");
check("undefined is handled", cleanAnswerText(undefined).summary === "");

console.log("\nThe shapes reasoning arrives in\n");

check(
  "a properly paired block",
  cleanAnswerText("<think>hmm, let me check</think>The answer is 42.").summary === "The answer is 42."
);
check(
  "an unclosed opening tag takes everything after it",
  cleanAnswerText("The answer is 42.<think>but wait, maybe").summary === "The answer is 42."
);
check(
  "a dangling closing tag takes everything before it",
  cleanAnswerText("rambling on and on\n</think>\nThe answer is 42.").summary === "The answer is 42."
);
check(
  "two rounds of thinking",
  cleanAnswerText("<think>one</think>middle<think>two</think>The answer is 42.").summary ===
    "middleThe answer is 42."
);
check(
  "the last dangling close wins",
  cleanAnswerText("first\n</think>\nsecond\n</thinking>\nThe answer is 42.").summary ===
    "The answer is 42."
);
check(
  "other names for the same thing",
  cleanAnswerText("<reasoning>x</reasoning>The answer is 42.").summary === "The answer is 42."
);

console.log("\nIts invented protocol\n");

check(
  "a summary tag is preferred over everything around it",
  cleanAnswerText("noise\n<summary>The real answer.</summary>\nmore noise").summary ===
    "The real answer."
);
check(
  "an answer tag works too",
  cleanAnswerText("<answer>The real answer.</answer>").summary === "The real answer."
);

// An <error> is a finding, not a failure. "No such student" is the answer to
// the question that was asked, and dropping it would leave a blank reply.
check(
  "an error block is used when there is no summary",
  cleanAnswerText("<error>No student matches that ID.</error>").summary ===
    "No student matches that ID."
);
check(
  "but a summary outranks it",
  cleanAnswerText("<error>bad</error><summary>good</summary>").summary === "good"
);

const withVisuals = cleanAnswerText(
  '<summary>Enrolment by centre.</summary><visuals>[{"type":"bar","title":"By centre","queryIndex":0,"xField":"center_name","yFields":["students"]}]</visuals>'
);
check("visuals written as JSON are recovered", withVisuals.visuals.length === 1);
check("with their type intact", withVisuals.visuals[0].type === "bar");
check("and the summary is still clean", withVisuals.summary === "Enrolment by centre.");

check(
  "visuals that are not JSON are ignored, not fatal",
  cleanAnswerText("<summary>ok</summary><visuals>a bar chart please</visuals>").visuals.length === 0
);
check(
  "and the summary still comes through",
  cleanAnswerText("<summary>ok</summary><visuals>nonsense</visuals>").summary === "ok"
);

console.log("\nMarkdown fences\n");

check(
  "a fenced block is unwrapped rather than shown as backticks",
  cleanAnswerText("```json\n{\"a\":1}\n```").summary === '{"a":1}',
  cleanAnswerText("```json\n{\"a\":1}\n```").summary
);

console.log("\nVisuals written as XML\n");

// The second reply that reached a screen. Having been given a tool schema
// and decided to answer in prose, the model wrote the visuals as nested
// elements. Every field is there and correct; only the encoding is wrong,
// and throwing three good charts away over that would be perverse.
const XML_VISUALS = `<summary>
Student Muhammad Ayaz is enrolled in Graphic Design with AI.
</summary>

<visuals>
  <visual>
    <type>table</type>
    <title>Student Profile Details</title>
    <queryIndex>6</queryIndex>
    <valueField>std_id</valueField>
    <labelField>std_cnic</labelField>
  </visual>
  <visual>
    <type>bar</type>
    <title>Quiz Scores Distribution</title>
    <queryIndex>9</queryIndex>
    <xField>quiz_code</xField>
    <yFields>["marks_obt"]</yFields>
  </visual>
  <visual>
    <type>stat</type>
    <title>Average Quiz Score</title>
    <queryIndex>9</queryIndex>
    <valueField>mean_marks_obt</valueField>
  </visual>
</visuals>`;

const xml = cleanAnswerText(XML_VISUALS);

check("all three visuals are recovered", xml.visuals.length === 3, String(xml.visuals.length));
check("their types survive", xml.visuals.map((v) => v.type).join(",") === "table,bar,stat");
check("titles survive", xml.visuals[1].title === "Quiz Scores Distribution");

// queryIndex is looked up as an array index. Left as the string "9" the
// visual points at nothing and is silently dropped.
check("queryIndex becomes a number", xml.visuals[1].queryIndex === 9, typeof xml.visuals[1].queryIndex);

// yFields is iterated. A string would be walked character by character.
check(
  "yFields becomes a real array",
  Array.isArray(xml.visuals[1].yFields) && xml.visuals[1].yFields[0] === "marks_obt",
  JSON.stringify(xml.visuals[1].yFields)
);

check("the summary is still clean", xml.summary === "Student Muhammad Ayaz is enrolled in Graphic Design with AI.", xml.summary);

// A bare field name, and a comma-separated list - both are things a model
// writes when it is improvising a format.
const bare = cleanAnswerText(
  "<visuals><visual><type>bar</type><yFields>males</yFields></visual></visuals>"
);
check("a bare yFields name still becomes an array", bare.visuals[0].yFields[0] === "males");

const listed = cleanAnswerText(
  "<visuals><visual><type>bar</type><yFields>males, females</yFields></visual></visuals>"
);
check("a comma-separated list is split", listed.visuals[0].yFields.length === 2, JSON.stringify(listed.visuals[0].yFields));

// A block with no type cannot be rendered and must not become a half-visual.
const typeless = cleanAnswerText(
  "<visuals><visual><title>Nameless</title></visual></visuals>"
);
check("a visual with no type is dropped", typeless.visuals.length === 0);

check(
  "an empty visuals block is still empty",
  cleanAnswerText("<summary>ok</summary><visuals></visuals>").visuals.length === 0
);

console.log("\nThe whole answer written as JSON\n");

// The third encoding seen live. The model had present_answer's shape exactly
// right and printed it instead of calling it, so the envelope reached the
// screen: { "summary": "Across the three training centres..." }
const OBJECT = JSON.stringify({
  summary: "Across the three training centres, male enrolment is higher than female.",
  visuals: [
    { type: "bar", title: "By centre", queryIndex: 1, xField: "center_name", yFields: ["males", "females"] },
  ],
});

const object = cleanAnswerText(OBJECT);
check("the summary is unwrapped", object.summary.startsWith("Across the three"), object.summary.slice(0, 40));
check("no braces reach the screen", !/^[{]/.test(object.summary), object.summary.slice(0, 20));
check("and its visuals come with it", object.visuals.length === 1 && object.visuals[0].type === "bar");

// Wrapped in a fence, and after a reasoning block - both happen together.
const fenced = cleanAnswerText(
  "<think>working it out</think>\n```json\n" + OBJECT + "\n```"
);
check("a fenced object is unwrapped too", fenced.summary.startsWith("Across the three"), fenced.summary.slice(0, 40));

// The other direction: prose that merely mentions JSON must stay prose, or
// an answer quoting a row of data would be mistaken for an envelope.
const mentions = cleanAnswerText(
  "The row {\"std_id\": 5233} is the only match."
);
check(
  "prose that mentions an object is left alone",
  mentions.summary === "The row {\"std_id\": 5233} is the only match.",
  mentions.summary
);

// An object with no summary is not the envelope and must not blank the answer.
const other = cleanAnswerText('{"rows": 3, "ok": true}');
check("an unrelated object stays as text", other.summary === '{"rows": 3, "ok": true}', other.summary);

const emptySummary = cleanAnswerText('{"summary": "   "}');
check("an empty summary does not win", emptySummary.summary !== "", emptySummary.summary);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
