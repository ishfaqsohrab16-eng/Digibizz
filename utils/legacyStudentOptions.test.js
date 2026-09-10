/**
 * Tests for translating stored dropdown positions back into words.
 *
 * Run with:  node utils/legacyStudentOptions.test.js
 * Exits non-zero if any rule regresses. No database - the repair runs against
 * a stub that records the SQL it would have sent.
 *
 * Every mapping here was recovered from the form as it stood before 40659a6.
 * A test failing on one of them means somebody edited the frozen lists, which
 * would silently re-label every record repaired with them.
 */

const queries = [];
const dbPath = require.resolve("../config/db");
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    sequelize: {
      query: async (sql, options) => {
        queries.push({ sql, options });
        return [undefined, 3];
      },
    },
  },
};

const {
  decodeQualification,
  decodeDistrict,
  LEGACY_QUALIFICATIONS,
  LEGACY_DISTRICTS,
} = require("./legacyStudentOptions");
const { repairLegacyOptions, _internals } = require("./repairLegacyOptions");

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

const main = async () => {
  console.log("\nThe student in the report\n");

  // Qualification "1", District "2", at a centre in Awaran.
  check("qualification 1 is Intermediate", decodeQualification("1") === "Intermediate");
  check("district 2 is Awaran", decodeDistrict("2") === "Awaran");

  console.log("\nThe ends of each old list\n");

  check("qualification 10 is PHD", decodeQualification("10") === "PHD");
  check("district 31 is Quetta", decodeDistrict("31") === "Quetta", decodeDistrict("31"));
  check("district 39 is Ziarat", decodeDistrict("39") === "Ziarat");
  check("the old lists are the lengths they were", LEGACY_QUALIFICATIONS.length === 10 && LEGACY_DISTRICTS.length === 38);

  console.log("\nNumbers the old form never produced are left alone\n");

  // Guessing would be worse than leaving them: a wrong district is invisible
  // once written, a strange one is at least visible.
  check("qualification 0 is unchanged", decodeQualification("0") === "0");
  check("qualification 11 is unchanged", decodeQualification("11") === "11");
  check("district 1 was never a district", decodeDistrict("1") === "1");
  check("district 40 is unchanged", decodeDistrict("40") === "40");

  console.log("\nReal values pass straight through\n");

  check("a district name is untouched", decodeDistrict("Quetta") === "Quetta");
  check("a qualification name is untouched", decodeQualification("Masters") === "Masters");
  check("a name containing digits is untouched", decodeQualification("B.Tech (4 Years)") === "B.Tech (4 Years)");
  check("undefined stays undefined", decodeDistrict(undefined) === undefined);
  check("an empty string stays empty", decodeDistrict("") === "");
  check("padding around a position is tolerated", decodeDistrict(" 31 ") === "Quetta");

  console.log("\nThe boot-time repair\n");

  const { sql, replacements } = _internals.caseUpdate("std_district", [
    ["2", "Awaran"],
    ["31", "Quetta"],
  ]);
  check("one statement, with a CASE", /UPDATE students SET std_district = CASE std_district/.test(sql), sql);
  check("unmatched rows keep their value", /ELSE std_district END/.test(sql), sql);
  check("only rows holding an old position are touched", /WHERE std_district IN \(\?, \?\)/.test(sql), sql);
  check(
    "every value goes through a replacement",
    JSON.stringify(replacements) === JSON.stringify(["2", "Awaran", "31", "Quetta", "2", "31"]),
    replacements
  );
  check("no value is written into the statement itself", !/Awaran|Quetta/.test(sql), sql);

  queries.length = 0;
  const result = await repairLegacyOptions();
  check("both columns are repaired", queries.length === 2, queries.length);
  check("and the counts are reported", result.qualifications === 3 && result.districts === 3, result);
  check(
    "every qualification position is covered",
    queries[0]?.options?.replacements?.length === LEGACY_QUALIFICATIONS.length * 3
  );
  check(
    "every district position is covered",
    queries[1]?.options?.replacements?.length === LEGACY_DISTRICTS.length * 3
  );
};

main().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
});
