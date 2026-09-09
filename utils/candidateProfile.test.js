/**
 * Tests for what a student inherits from the candidate they were enrolled from.
 *
 * Run with:  node utils/candidateProfile.test.js
 * Exits non-zero if any rule regresses. No database.
 *
 * The rules here exist because a student row with a blank district is not
 * obviously wrong on screen - it just looks like nobody filled it in - so the
 * mapping has to be checked rather than eyeballed.
 */

const {
  text,
  isBlank,
  districtOf,
  qualificationOf,
  profileFromCandidate,
  missingFromCandidate,
} = require("./candidateProfile");

let passed = 0;
let failed = 0;

const check = (name, condition, detail) => {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail !== undefined ? `  ->  ${JSON.stringify(detail)}` : ""}`);
  }
};

const full = {
  cand_id: 7,
  cand_cnic: "35202-1234567-1",
  cand_local_domicile: "Quetta",
  cand_degree_level: "Bachelors",
  degree_area: "Computer Science",
  current_city: "Karachi",
};

console.log("\nReading a candidate's details\n");

check("the district is the local domicile", districtOf(full) === "Quetta", districtOf(full));
check(
  "the qualification is the degree LEVEL",
  qualificationOf(full) === "Bachelors",
  qualificationOf(full)
);

// The two most tempting wrong answers. Degree area is the subject, and the
// current city is where somebody lives now - neither is what these columns
// mean, and filling a blank with one would be invisible once written.
check(
  "the degree area is not used as the qualification",
  qualificationOf({ cand_degree_level: "", degree_area: "Computer Science" }) === "",
);
check(
  "the current city is not used as the district",
  districtOf({ cand_local_domicile: "", current_city: "Karachi" }) === ""
);

console.log("\nValues that carry no information\n");

check("undefined is blank", isBlank(undefined));
check("null is blank", isBlank(null));
check("spaces are blank", isBlank("   "));
// Spreadsheet imports have arrived carrying the word itself before now.
check("the string 'null' is blank", isBlank("null"));
check("the string 'undefined' is blank", isBlank("undefined"));
check("a real value is not blank", !isBlank(" Quetta "));
check("and is trimmed", text("  Quetta  ") === "Quetta", text("  Quetta  "));

console.log("\nWhat gets copied onto the student\n");

const both = profileFromCandidate(full);
check(
  "both columns when the candidate has both",
  both.std_district === "Quetta" && both.std_qualification === "Bachelors",
  both
);

// The reason blanks are omitted rather than sent as "": a caller spreading
// this over an existing student must not wipe a value somebody typed in.
const partial = profileFromCandidate({ cand_local_domicile: "Quetta", cand_degree_level: "  " });
check("a blank field is omitted, not sent as an empty string", !("std_qualification" in partial), partial);
check("and the one that is there still comes through", partial.std_district === "Quetta", partial);

const nothing = profileFromCandidate({});
check("an empty candidate copies nothing", Object.keys(nothing).length === 0, nothing);
check("and neither does undefined", Object.keys(profileFromCandidate(undefined)).length === 0);

console.log("\nSaying what the candidate could not supply\n");

check("nothing missing when both are there", missingFromCandidate(full).length === 0);
check(
  "the district is named when the domicile is empty",
  missingFromCandidate({ cand_degree_level: "Bachelors" }).join() === "std_district",
  missingFromCandidate({ cand_degree_level: "Bachelors" })
);
check(
  "both are named when the record is empty",
  missingFromCandidate({}).join() === "std_district,std_qualification",
  missingFromCandidate({})
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
