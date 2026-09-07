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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
