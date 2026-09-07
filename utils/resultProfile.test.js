/**
 * Tests for the statistics handed to the assistant in place of raw rows.
 *
 * Run with:  node utils/resultProfile.test.js
 * Exits non-zero if any rule regresses.
 *
 * The point of this module is that an answer stating a total or an average is
 * right about the WHOLE result rather than about the sample the model saw. So
 * the cases that matter are the ones where a plausible-looking shortcut gives
 * a confidently wrong number.
 */
const { profileRows, describeProfile } = require("./resultProfile");

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

console.log("\nNothing to describe\n");

check("no rows", describeProfile(profileRows([])) === "no rows");
check("not an array", profileRows(null).rowCount === 0);
check("undefined", describeProfile(profileRows(undefined)) === "no rows");

console.log("\nNumbers\n");

const marks = [
  { student: "A", mark: 40 },
  { student: "B", mark: 60 },
  { student: "C", mark: 80 },
];
let profile = profileRows(marks);
let mark = profile.columns.find((column) => column.name === "mark");

check("the row count is the true one", profile.rowCount === 3);
check("a numeric column is recognised", mark.type === "number");
check("the range is right", mark.min === 40 && mark.max === 80);
check("the total is right", mark.sum === 180);
check("the mean is right", mark.mean === 60);

// Marks are stored as TEXT in this database. Refusing to average them because
// of that would make the profile useless for the commonest question there is.
profile = profileRows([{ obt_marks: "40" }, { obt_marks: "61.5" }, { obt_marks: "80" }]);
mark = profile.columns[0];
check("numeric strings are still numbers", mark.type === "number");
check("and are averaged correctly", mark.mean === 60.5, String(mark.mean));

// The other half of that: things that are digits but are not quantities. A
// roll number averaged is a number that means nothing, presented as a finding.
profile = profileRows([{ roll: "007" }, { roll: "008" }, { roll: "009" }]);
check("zero-padded identifiers are not numbers", profile.columns[0].type === "text");

profile = profileRows([{ code: "12" }, { code: "AB" }, { code: "14" }]);
check(
  "one non-numeric value makes the whole column text",
  profile.columns[0].type === "text"
);

// The mean must be over the values that EXIST, not over the row count, or
// every column with a gap in it reports an average that is too low.
profile = profileRows([{ mark: 50 }, { mark: null }, { mark: 100 }]);
mark = profile.columns[0];
check("missing values are counted", mark.missing === 1);
check("and excluded from the mean", mark.mean === 75, String(mark.mean));
check("and from the total", mark.sum === 150);

// Empty string is missing, not zero. Reading it as zero drags every average
// down and the answer looks merely surprising rather than wrong.
profile = profileRows([{ mark: 50 }, { mark: "" }, { mark: 100 }]);
check("an empty string is missing, not zero", profile.columns[0].mean === 75);

check("decimals are tidied, not left as 60.000000000000004", tidy());
function tidy() {
  const p = profileRows([{ n: 0.1 }, { n: 0.2 }]);
  return p.columns[0].sum === 0.3;
}

console.log("\nCategories\n");

profile = profileRows([
  { centre: "UoB", gender: "Male" },
  { centre: "UoB", gender: "Female" },
  { centre: "BUITEMS", gender: "Male" },
]);
const centre = profile.columns.find((column) => column.name === "centre");

check("a text column is recognised", centre.type === "text");
check("distinct values are counted", centre.distinct === 2);
check("and the commonest are listed with their counts", centre.top[0].value === "UoB" && centre.top[0].count === 2);

// A column of 500 unique names has nothing useful to say in its top four, and
// listing them would cost tokens to tell the model something it can see.
const names = Array.from({ length: 60 }, (_, i) => ({ name: `Person ${i}` }));
profile = profileRows(names);
check("a column of unique values lists none of them", profile.columns[0].top === undefined);
check("but still says how many there are", profile.columns[0].distinct === 60);

console.log("\nDates\n");

profile = profileRows([
  { applied: "2026-03-04" },
  { applied: "2026-01-15" },
  { applied: "2026-07-22" },
]);
check("a date column is recognised", profile.columns[0].type === "date");
check("earliest and latest are found", profile.columns[0].earliest === "2026-01-15");
check("regardless of row order", profile.columns[0].latest === "2026-07-22");

profile = profileRows([{ at: new Date("2026-05-01T10:00:00Z") }]);
check("real Date objects too", profile.columns[0].type === "date");

console.log("\nWhat the model actually reads\n");

const wide = Array.from({ length: 500 }, (_, i) => ({
  center_name: i % 3 === 0 ? "UoB" : "BUITEMS",
  students: i,
  joined: "2026-02-01",
}));

const text = describeProfile(profileRows(wide));

check("it states the true row count", /^500 row\(s\)/.test(text), text.slice(0, 40));
check("it names every column", /center_name/.test(text) && /students/.test(text) && /joined/.test(text));
check("it gives the total over all rows", /total 124750/.test(text), text);

// The whole economic argument for this module. The profile has to be much
// smaller than the rows it replaces or it is not worth sending.
const asJson = JSON.stringify(wide);
check(
  "and is far cheaper than the rows",
  text.length < asJson.length / 10,
  `${text.length} vs ${asJson.length}`
);

console.log("\nColumns that are labels, not quantities\n");

// The cards showed "attempt_id - 3,510 total, mean 877.5" for four quiz
// attempts. Both numbers are arithmetically correct and mean nothing: it is
// the sum of four primary keys.
profile = profileRows([
  { attempt_id: 876, marks_obt: 100 },
  { attempt_id: 877, marks_obt: 0 },
  { attempt_id: 878, marks_obt: 90 },
  { attempt_id: 879, marks_obt: 0 },
]);
const attemptId = profile.columns.find((column) => column.name === "attempt_id");
const marksObt = profile.columns.find((column) => column.name === "marks_obt");

check("an id column is recognised as an identifier", attemptId.role === "identifier");
check("and is not totalled", attemptId.sum === undefined, String(attemptId.sum));
check("nor averaged", attemptId.mean === undefined);
check(
  "its range is still shown, which is mildly useful",
  attemptId.min === 876 && attemptId.max === 879
);
check(
  "the real measure beside it is untouched",
  marksObt.sum === 190 && marksObt.mean === 47.5
);

// The useful column has to come FIRST, or the four cards on screen are four
// keys and the marks are hidden behind "8 more columns".
check(
  "measures are ordered ahead of identifiers",
  profile.columns[0].name === "marks_obt",
  profile.columns.map((c) => c.name).join(", ")
);

for (const name of ["std_id", "center_id", "std_cnic", "quiz_code", "std_rollno", "user_id"]) {
  const only = profileRows([{ [name]: 1 }, { [name]: 2 }, { [name]: 3 }]).columns[0];
  check(name + " is an identifier", only.role === "identifier", only.role);
}

// The other half: names that merely contain a keyword must stay measures, or
// the totals people actually want disappear.
for (const name of ["students", "student_count", "total_marks", "males", "females"]) {
  const only = profileRows([{ [name]: 10 }, { [name]: 20 }]).columns[0];
  check(name + " is still a measure", only.role === "measure", only.role);
  check("and " + name + " keeps its total", only.sum === 30);
}

console.log("\nColumns with nothing to say\n");

// std_cnic on one student's rows: a single value, repeated. It was drawn as
// a bar at 100%, which is a chart of the fact that a filter worked.
profile = profileRows([
  { std_cnic: "56201-6232048-1", mark: 10 },
  { std_cnic: "56201-6232048-1", mark: 20 },
]);
const cnic = profile.columns.find((column) => column.name === "std_cnic");
check("one value for every row is a constant", cnic.role === "constant");
check("and the value itself is what is reported", cnic.value === "56201-6232048-1");
check("with no bar chart of a single category", cnic.top === undefined);

// attempt_session: a different value on every row. Four bars at 25% each
// told the reader that four rows are four rows.
profile = profileRows([
  { attempt_session: "QZ-a" },
  { attempt_session: "QZ-b" },
  { attempt_session: "QZ-c" },
  { attempt_session: "QZ-d" },
]);
check("a value per row is unique, not categorical", profile.columns[0].role === "unique");
check("and none of them are listed", profile.columns[0].top === undefined);
check("but the count still is", profile.columns[0].distinct === 4);

// A column that genuinely repeats is still worth breaking down.
profile = profileRows([{ gender: "Male" }, { gender: "Male" }, { gender: "Female" }]);
check("a repeating column stays categorical", profile.columns[0].role === "category");
check("and keeps its breakdown", profile.columns[0].top.length === 2);

console.log("\nWhat the model is told about them\n");

const told = describeProfile(
  profileRows([
    { attempt_id: 876, std_cnic: "56201-6232048-1", marks_obt: 100 },
    { attempt_id: 877, std_cnic: "56201-6232048-1", marks_obt: 0 },
  ])
);

check("no total is offered for an id", !/attempt_id.*total/.test(told), told);
check("it is named as an identifier instead", /attempt_id.*identifier/.test(told), told);
check("a constant is stated once", /always "56201-6232048-1"/.test(told), told);
check("the measure keeps its figures", /marks_obt.*total 100/.test(told), told);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
