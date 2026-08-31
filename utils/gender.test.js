/**
 * Regression tests for gender normalisation.
 *
 * Run with:  node utils/gender.test.js
 * Exits non-zero if any rule regresses. No test framework required.
 *
 * The bug this protects against: the registration form posts "female", the
 * students table validates against ["Male", "Female", "Other"], and enrolling a
 * candidate copies one into the other - so every female applicant failed to
 * enrol on `Validation isIn on std_gender failed`. Correct data, refused over
 * its capitalisation.
 */
const { normaliseGender, isGender, CANONICAL } = require("./gender");

let passed = 0;
let failed = 0;

const check = (label, actual, expected) => {
  const ok = Object.is(actual, expected);
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(
      `  FAIL  ${label}\n        got ${JSON.stringify(actual)}, wanted ${JSON.stringify(expected)}`
    );
  }
};

console.log("\nGender normalisation\n");

// The exact value that broke enrolment.
check('"female" becomes "Female"', normaliseGender("female"), "Female");
check('"male" becomes "Male"', normaliseGender("male"), "Male");

check("already canonical is left alone", normaliseGender("Female"), "Female");
check("shouting is handled", normaliseGender("MALE"), "Male");
check("mixed case is handled", normaliseGender("FeMaLe"), "Female");
check("surrounding space is trimmed", normaliseGender("  female  "), "Female");

check("a single letter works", normaliseGender("f"), "Female");
check("and its counterpart", normaliseGender("M"), "Male");
check('"other" is canonical too', normaliseGender("OTHER"), "Other");

console.log("\nWhat must NOT be invented\n");

// An unrecognised value has to fail validation loudly. Coercing it to "Other"
// would record something the applicant never said.
check("an unknown word passes through untouched", normaliseGender("xyz"), "xyz");
check("an empty string stays empty", normaliseGender(""), "");
check("null stays null", normaliseGender(null), null);
check("undefined stays undefined", normaliseGender(undefined), undefined);

console.log("\nEvery canonical value survives a round trip\n");

for (const value of CANONICAL) {
  check(`${value} is stable`, normaliseGender(value), value);
  check(`${value.toLowerCase()} maps to it`, normaliseGender(value.toLowerCase()), value);
}

console.log("\nComparing historical rows\n");

// Rows written before the model normalised gender still hold whatever they were
// given, so reports that compare with === silently undercount them.
check('"female" matches "Female"', isGender("female", "Female"), true);
check('"MALE" matches "Male"', isGender("MALE", "Male"), true);
check("a male row does not match Female", isGender("male", "Female"), false);
check("null matches nothing", isGender(null, "Male"), false);
check("an unknown value matches nothing", isGender("xyz", "Male"), false);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
