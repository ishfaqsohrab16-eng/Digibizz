const XLSX = require("xlsx");

/**
 * Turns an uploaded Excel/CSV of CNIC numbers into a list to enrol.
 *
 * The file is typed by hand from an interview panel's notes, so it arrives with
 * the CNIC written every way a person might write it: with dashes, without,
 * with spaces, padded, and occasionally as a number Excel has helpfully
 * reformatted. None of that should fail the upload. What should fail is a value
 * nobody can turn back into a CNIC, and that has to be reported by its
 * spreadsheet row so it can actually be fixed.
 */

/** Header names accepted for the CNIC column, after normalisation. */
const CNIC_HEADERS = [
  "cnic",
  "cnicno",
  "cnicnumber",
  "nic",
  "nicno",
  "idcard",
  "idcardnumber",
  "cnr",
];

/** Upper bound on one upload. A batch is hundreds of people, not thousands. */
const MAX_ROWS = 5000;

/** A Pakistani CNIC is exactly thirteen digits. */
const CNIC_LENGTH = 13;

const normaliseHeader = (value) =>
  String(value ?? "").trim().toLowerCase().replace(/[\s._-]+/g, "");

/** Everything that is not a digit goes: dashes, spaces, stray apostrophes. */
const normaliseCnic = (value) => String(value ?? "").replace(/\D/g, "");

/**
 * Excel turns a long number into scientific notation, and the digits are then
 * genuinely gone - "3.52021E+12" cannot be turned back into a CNIC. Detected
 * separately so the message can say what to do about it, because "invalid CNIC"
 * on a value the operator can see is correct in their spreadsheet is maddening.
 */
const looksLikeScientificNotation = (value) =>
  /^\s*\d(\.\d+)?\s*[eE]\s*[+-]?\s*\d+\s*$/.test(String(value ?? ""));

/** The readable form, for showing back to whoever uploaded the file. */
const formatCnic = (digits) =>
  digits.length === CNIC_LENGTH
    ? `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`
    : digits;

/**
 * Every spelling of one CNIC that might be sitting in the database.
 *
 * Registration strips the dashes before saving, but rows imported from
 * spreadsheets over the years did not, so a lookup on the bare digits alone
 * silently misses them - which on this feature would read as "candidate not
 * found" for somebody who is plainly there.
 */
const cnicVariants = (digits) => {
  const variants = new Set([digits, formatCnic(digits)]);
  if (digits.length === CNIC_LENGTH) {
    variants.add(`${digits.slice(0, 5)} ${digits.slice(5, 12)} ${digits.slice(12)}`);
  }
  return [...variants];
};

/**
 * @param {Buffer} buffer         the uploaded file
 * @param {string} [originalName] used only in error messages
 * @returns {{cnics: Array, skipped: Array, headers: string[], total: number}}
 */
const parseCnicList = (buffer, originalName = "the file") => {
  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    throw new Error(
      `Could not read ${originalName}. Please upload a .xlsx or .csv file.`
    );
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("That file has no sheets in it.");

  // defval keeps empty cells as "" so a row's columns stay aligned; raw:false
  // gives the displayed text, which is what a hand-typed CNIC actually is.
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
  const cnicHeader = CNIC_HEADERS.map((key) => headerMap.get(key)).find(Boolean);

  if (!cnicHeader) {
    throw new Error(
      `No CNIC column found. Add a column headed "CNIC" - the file has: ${
        headers.join(", ") || "(no headers)"
      }`
    );
  }

  const cnics = [];
  const skipped = [];
  const seen = new Set();

  rows.forEach((row, index) => {
    // +2: one for the header row, one because spreadsheets count from 1. This
    // is the number shown in Excel, which is the only one useful for fixing it.
    const line = index + 2;
    const raw = String(row[cnicHeader] ?? "").trim();
    const digits = normaliseCnic(raw);

    if (!raw) {
      // A trailing blank row is normal in a hand-edited sheet, not an error.
      const hasAnyValue = Object.values(row).some(
        (value) => String(value ?? "").trim() !== ""
      );
      if (hasAnyValue) skipped.push({ line, raw, reason: "No CNIC in this row" });
      return;
    }

    if (looksLikeScientificNotation(raw)) {
      skipped.push({
        line,
        raw,
        reason:
          "Excel has stored this as a number and the digits are lost. Format the CNIC column as Text and re-enter it.",
      });
      return;
    }

    if (digits.length !== CNIC_LENGTH) {
      skipped.push({
        line,
        raw,
        reason: `A CNIC has ${CNIC_LENGTH} digits; this has ${digits.length}`,
      });
      return;
    }

    if (seen.has(digits)) {
      skipped.push({
        line,
        raw,
        reason: "Duplicate of an earlier row",
      });
      return;
    }
    seen.add(digits);

    cnics.push({ cnic: digits, formatted: formatCnic(digits), raw, line });
  });

  return { cnics, skipped, headers, total: rows.length };
};

/**
 * The CSV handed to operators so they know the expected shape.
 *
 * One column. The examples are written with dashes on purpose - that is how a
 * CNIC appears on the card, it is what people will type, and it proves the
 * parser accepts it.
 *
 * The BOM makes Excel open it as UTF-8 rather than the local codepage.
 */
const buildCnicTemplateCsv = () =>
  `﻿CNIC\r\n35202-1234567-1\r\n42101-7654321-9\r\n`;

module.exports = {
  parseCnicList,
  buildCnicTemplateCsv,
  normaliseCnic,
  formatCnic,
  cnicVariants,
  CNIC_LENGTH,
  MAX_ROWS,
};
