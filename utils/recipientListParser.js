const XLSX = require("xlsx");

/**
 * Turns an uploaded Excel/CSV file into a campaign recipient list.
 *
 * The file is authored by a person in a spreadsheet, so it will arrive with
 * inconsistent header casing, stray spaces, blank filler rows, duplicated
 * addresses and the occasional cell that is not an email at all. Every one of
 * those is normal, none of them should fail the whole upload, and all of them
 * must be reported - an operator who is told "312 accepted, 4 skipped" and can
 * see which four will fix the file. One that is told "invalid file" will not.
 */

/** Header names accepted for the address column, after normalisation. */
const EMAIL_HEADERS = ["email", "emailaddress", "email_address", "mail", "e-mail"];

/** Header names accepted for the recipient's name. */
const NAME_HEADERS = ["name", "fullname", "full_name", "recipient", "student", "candidate"];

/** Upper bound on one upload, so a stray file cannot queue a million sends. */
const MAX_ROWS = 20000;

const normaliseHeader = (value) =>
  String(value ?? "").trim().toLowerCase().replace(/[\s.-]+/g, "");

const normaliseEmail = (value) => String(value ?? "").trim().toLowerCase();

/**
 * Deliberately permissive. Address validity is ultimately decided by the
 * receiving mail server; this only catches what is obviously not an address,
 * so a legitimate but unusual one is not silently dropped.
 */
const looksLikeEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 150;

/**
 * @param {Buffer} buffer            The uploaded file.
 * @param {string} [originalName]    Used only for the error message.
 * @returns {{recipients: Array, skipped: Array, headers: string[], total: number}}
 */
const parseRecipientList = (buffer, originalName = "the file") => {
  let workbook;
  try {
    // cellDates keeps a date cell a Date rather than an Excel serial number,
    // which would otherwise merge into an email as "45678".
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch (error) {
    throw new Error(
      `Could not read ${originalName}. Please upload a .xlsx or .csv file.`
    );
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("That file has no sheets in it.");
  }

  // defval keeps empty cells as "" so a row's columns stay aligned; a missing
  // key would otherwise shift values into the wrong field.
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: "",
    raw: false,
  });

  if (rows.length === 0) {
    throw new Error("That file has no rows below the header.");
  }
  if (rows.length > MAX_ROWS) {
    throw new Error(
      `That file has ${rows.length} rows. Please split it - the limit is ${MAX_ROWS} per upload.`
    );
  }

  const headers = Object.keys(rows[0] || {});
  const headerMap = new Map(headers.map((header) => [normaliseHeader(header), header]));

  const emailHeader = EMAIL_HEADERS.map((key) => headerMap.get(key)).find(Boolean);
  if (!emailHeader) {
    throw new Error(
      `No email column found. Add a column headed "Email" - the file has: ${
        headers.join(", ") || "(no headers)"
      }`
    );
  }

  const nameHeader = NAME_HEADERS.map((key) => headerMap.get(key)).find(Boolean);

  const recipients = [];
  const skipped = [];
  const seen = new Set();

  rows.forEach((row, index) => {
    // +2: one for the header row, one because spreadsheets count from 1. This
    // is the number the operator sees in Excel, which is the only one useful
    // for fixing the file.
    const line = index + 2;
    const email = normaliseEmail(row[emailHeader]);

    if (!email) {
      // A trailing blank row is normal in a hand-edited sheet, not an error
      // worth reporting.
      const hasAnyValue = Object.values(row).some(
        (value) => String(value ?? "").trim() !== ""
      );
      if (hasAnyValue) skipped.push({ line, email: "", reason: "No email address" });
      return;
    }

    if (!looksLikeEmail(email)) {
      skipped.push({ line, email, reason: "Not a valid email address" });
      return;
    }

    if (seen.has(email)) {
      skipped.push({ line, email, reason: "Duplicate of an earlier row" });
      return;
    }
    seen.add(email);

    // Every other column becomes a merge token, so a sheet can carry whatever
    // the message needs without this parser knowing about it in advance.
    const merge = {};
    for (const header of headers) {
      if (header === emailHeader) continue;
      const key = normaliseHeader(header);
      const value = row[header];
      if (String(value ?? "").trim() === "") continue;
      merge[key] = String(value).trim();
    }

    recipients.push({
      email,
      name: nameHeader ? String(row[nameHeader] ?? "").trim() : "",
      merge,
      line,
    });
  });

  return { recipients, skipped, headers, total: rows.length };
};

/**
 * The CSV handed to operators so they know the expected shape.
 *
 * One column. The list is a plain set of addresses and every one of them
 * receives the same message, so nothing else is required.
 *
 * Extra columns are still read if a file happens to carry them - they become
 * merge tokens for a custom template - but nobody has to supply any, and the
 * template deliberately does not suggest otherwise.
 */
const TEMPLATE_HEADERS = ["Email"];

const buildTemplateCsv = () => {
  const rows = [
    TEMPLATE_HEADERS.join(","),
    "ali.khan@example.com",
    "sana.baloch@example.com",
  ];
  // BOM so Excel opens it as UTF-8 rather than the system codepage.
  return "﻿" + rows.join("\r\n") + "\r\n";
};

module.exports = {
  parseRecipientList,
  buildTemplateCsv,
  TEMPLATE_HEADERS,
  MAX_ROWS,
  // Exported for tests.
  normaliseHeader,
  looksLikeEmail,
};
