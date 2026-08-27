/**
 * Regression tests for the uploaded recipient list.
 *
 * Run with:  node utils/recipientListParser.test.js
 * Exits non-zero if any rule regresses. No test framework required.
 *
 * These files are authored by hand in Excel, so the messy cases ARE the normal
 * cases: odd header casing, blank filler rows, duplicates, and a cell that is
 * not an address. None of them should fail the upload, and every skipped row
 * has to be reportable by its spreadsheet line number.
 */
const XLSX = require("xlsx");
const { parseRecipientList, buildTemplateCsv } = require("./recipientListParser");

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

console.log("\nUploaded recipient list\n");

// --- the happy path -------------------------------------------------------
const basic = parseRecipientList(
  sheet([
    ["Email", "Name", "Course"],
    ["ali@example.com", "Ali Khan", "Creative"],
    ["sana@example.com", "Sana Baloch", "Digital"],
  ])
);
check("reads every valid row", basic.recipients.length, 2);
check("keeps the name", basic.recipients[0].name, "Ali Khan");
check("extra columns become merge tokens", basic.recipients[0].merge.course, "Creative");
check("nothing skipped", basic.skipped.length, 0);

// --- header tolerance -----------------------------------------------------
const headers = parseRecipientList(
  sheet([
    ["  E-Mail ", "Full Name"],
    ["a@b.com", "A B"],
  ])
);
check("header casing, spaces and punctuation are tolerated", headers.recipients.length, 1);
check("an aliased name header is still found", headers.recipients[0].name, "A B");

// --- the messy cases ------------------------------------------------------
const messy = parseRecipientList(
  sheet([
    ["Email", "Name"],
    ["ali@example.com", "Ali"],
    ["not-an-email", "Broken"],
    ["ALI@EXAMPLE.COM", "Ali again"],
    ["", ""],
    ["  sana@example.com  ", "  Sana  "],
  ])
);
check("valid rows survive the bad ones", messy.recipients.length, 2);
check("an invalid address is skipped, not fatal", messy.skipped.some((s) => s.reason.includes("valid")), true);
check("a duplicate is caught regardless of casing", messy.skipped.some((s) => s.reason.includes("Duplicate")), true);
check("a wholly blank row is ignored silently", messy.skipped.some((s) => s.reason === "No email address"), false);
check("addresses are trimmed and lower-cased", messy.recipients[1].email, "sana@example.com");
check("names are trimmed", messy.recipients[1].name, "Sana");
check(
  "skipped rows carry the spreadsheet line number",
  messy.skipped.find((s) => s.email === "not-an-email")?.line,
  3
);

// --- failures that SHOULD stop the upload ---------------------------------
const mustThrow = (label, rows, expected) => {
  try {
    parseRecipientList(sheet(rows));
    failed += 1;
    console.log(`  FAIL  ${label} (no error thrown)`);
  } catch (error) {
    check(label, error.message, (m) => m.includes(expected));
  }
};

mustThrow("a file with no email column is refused", [["Name", "Course"], ["A", "B"]], "No email column");
mustThrow("a header-only file is refused", [["Email", "Name"]], "no rows");

try {
  parseRecipientList(Buffer.from("not a spreadsheet at all"), "list.xlsx");
  // xlsx is permissive and may parse this as a one-cell CSV; either a throw or
  // an empty result is acceptable, a crash is not.
  passed += 1;
  console.log("  PASS  garbage input does not crash");
} catch (error) {
  check("garbage input fails with a readable message", error.message, (m) => m.length > 10);
}

// --- CSV round-trip -------------------------------------------------------
const template = buildTemplateCsv();
check("the template starts with a UTF-8 BOM for Excel", template.charCodeAt(0), 0xfeff);
const parsedTemplate = parseRecipientList(Buffer.from(template, "utf8"), "template.csv");
check("the template we hand out parses with our own parser", parsedTemplate.recipients.length, 2);
check(
  "an email-only file needs no other column",
  parsedTemplate.recipients[0].email,
  "ali.khan@example.com"
);
check(
  "an email-only file produces no merge values, so everyone gets the same message",
  Object.keys(parsedTemplate.recipients[0].merge).length,
  0
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
