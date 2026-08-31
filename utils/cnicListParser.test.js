/**
 * Regression tests for the uploaded CNIC list.
 *
 * Run with:  node utils/cnicListParser.test.js
 * Exits non-zero if any rule regresses. No test framework required.
 *
 * These files are typed by hand from an interview panel's notes, so the messy
 * cases ARE the normal cases: dashes, spaces, blank filler rows, duplicates,
 * and the one Excel turned into a number. None of them should fail the upload,
 * and every skipped row has to be reportable by its spreadsheet line.
 */
const XLSX = require("xlsx");
const {
  parseCnicList,
  buildCnicTemplateCsv,
  normaliseCnic,
  formatCnic,
  cnicVariants,
} = require("./cnicListParser");

let passed = 0;
let failed = 0;

const check = (label, actual, expected) => {
  const ok =
    typeof expected === "function" ? expected(actual) : String(actual) === String(expected);
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}\n        got: ${JSON.stringify(actual)}`);
  }
};

/** Build an .xlsx in memory from rows of arrays. */
const sheet = (rows) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Sheet1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
};

console.log("\nUploaded CNIC list\n");

// --- every way a person writes a CNIC -------------------------------------
const written = parseCnicList(
  sheet([
    ["CNIC"],
    ["35202-1234567-1"],
    ["4210176543219"],
    ["  61101 2345678 3  "],
  ])
);
check("all three spellings are read", written.cnics.length, 3);
check("dashes are stripped", written.cnics[0].cnic, "3520212345671");
check("bare digits are kept", written.cnics[1].cnic, "4210176543219");
check("spaces and padding are stripped", written.cnics[2].cnic, "6110123456783");
check("nothing is skipped", written.skipped.length, 0);
check(
  "the readable form is kept for showing back",
  written.cnics[0].formatted,
  "35202-1234567-1"
);

// --- header tolerance -----------------------------------------------------
check(
  "an aliased header is found",
  parseCnicList(sheet([["  CNIC No. "], ["3520212345671"]])).cnics.length,
  1
);
check(
  "so is a differently-named one",
  parseCnicList(sheet([["ID Card Number"], ["3520212345671"]])).cnics.length,
  1
);

// --- extra columns are none of our business -------------------------------
const extras = parseCnicList(
  sheet([
    ["CNIC", "Name", "Center"],
    ["3520212345671", "Ali Khan", "Quetta"],
  ])
);
check("an extra column does not fail the upload", extras.cnics.length, 1);
check(
  "and nothing from it is carried along - the database is the source of truth",
  Object.keys(extras.cnics[0]).sort().join(","),
  "cnic,formatted,line,raw"
);

// --- the messy cases ------------------------------------------------------
const messy = parseCnicList(
  sheet([
    ["CNIC"],
    ["3520212345671"],
    ["12345"],
    ["35202-1234567-1"],
    [""],
    ["not a cnic"],
  ])
);
check("valid rows survive the bad ones", messy.cnics.length, 1);
check(
  "a short number is skipped with its digit count",
  messy.skipped.some((s) => /has 5/.test(s.reason)),
  true
);
check(
  "the same CNIC written two ways is caught as a duplicate",
  messy.skipped.some((s) => s.reason.includes("Duplicate")),
  true
);
check(
  "a wholly blank row is ignored silently",
  messy.skipped.some((s) => s.reason === "No CNIC in this row"),
  false
);
check(
  "skipped rows carry the spreadsheet line number",
  messy.skipped.find((s) => s.raw === "12345")?.line,
  3
);

// --- the Excel trap -------------------------------------------------------
// A CNIC stored as a number becomes 3.52021E+12 and the digits are genuinely
// gone. "Invalid CNIC" on a value that looks right in the sheet is maddening,
// so this gets its own message.
const scientific = parseCnicList(sheet([["CNIC"], ["3.52021E+12"]]));
check("scientific notation is skipped", scientific.cnics.length, 0);
check(
  "and the message says how to fix the spreadsheet",
  scientific.skipped[0]?.reason,
  (reason) => /format the cnic column as text/i.test(reason)
);

// --- failures that SHOULD stop the upload ---------------------------------
const mustThrow = (label, rows, expected) => {
  try {
    parseCnicList(sheet(rows));
    failed += 1;
    console.log(`  FAIL  ${label} (no error thrown)`);
  } catch (error) {
    check(label, error.message, (m) => m.includes(expected));
  }
};

mustThrow(
  "a file with no CNIC column is refused",
  [["Name", "Center"], ["A", "B"]],
  "No CNIC column"
);
mustThrow("a header-only file is refused", [["CNIC"]], "no rows");

console.log("\nMatching against what is already stored\n");

check("normaliseCnic strips everything but digits", normaliseCnic("352-02 1234'567-1"), "3520212345671");
check("formatCnic produces the form on the card", formatCnic("3520212345671"), "35202-1234567-1");

// Registration strips dashes before saving, but rows imported from spreadsheets
// over the years did not. A lookup on bare digits alone silently misses them,
// which would read as "candidate not found" for somebody plainly there.
const variants = cnicVariants("3520212345671");
check("the bare digits are looked for", variants.includes("3520212345671"), true);
check("so is the dashed form", variants.includes("35202-1234567-1"), true);
check("and the spaced form", variants.includes("35202 1234567 1"), true);

console.log("\nThe template we hand out\n");

const template = buildCnicTemplateCsv();
check("starts with a UTF-8 BOM so Excel reads it correctly", template.charCodeAt(0), 0xfeff);
const parsedTemplate = parseCnicList(Buffer.from(template, "utf8"), "template.csv");
check("parses with our own parser", parsedTemplate.cnics.length, 2);
check("nothing in it is skipped", parsedTemplate.skipped.length, 0);
check(
  "its examples are written with dashes, the way people type them",
  /\d{5}-\d{7}-\d/.test(template),
  true
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
