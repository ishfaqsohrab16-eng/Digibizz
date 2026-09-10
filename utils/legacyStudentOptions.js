/**
 * Translating the numbers an old form stored in place of words.
 *
 * Until 40659a6 the student form rendered District and Qualification as
 * dropdowns whose option VALUES were list positions, while the columns store
 * names. Saving the form - adding a student, or editing one for any reason -
 * wrote the position: "31" where "Quetta" belonged, "1" for "Intermediate".
 *
 * These lists are that old encoding, FROZEN. They are recovered from the form
 * as it stood before the fix and must never be edited to follow the current
 * option lists: a stored "31" means Quetta because position 31 WAS Quetta
 * when it was written, whatever the dropdown says today. Reordering these
 * would silently re-label every repaired record.
 *
 * A value that is not a bare number, or a number outside the old range, is
 * returned untouched. Guessing would be worse than leaving it: a wrong
 * district is invisible once written, and a strange one is at least visible.
 */

/** Qualification: stored as the 1-based position in this list. */
const LEGACY_QUALIFICATIONS = Object.freeze([
  "Intermediate",
  "B.Tech (2 Years)",
  "B.Tech (3 Years)",
  "B.Tech (4 Years)",
  "Bachelors (2 Years)",
  "Bachelors (4 Years)",
  "Bachelors (5 Years)",
  "Masters",
  "MPHIL",
  "PHD",
]);

/**
 * District: stored as the position in this list PLUS TWO. The old list began
 * at id 2 - Awaran was 2, Ziarat 39 - so a stored "1" was never a district and
 * is left alone.
 */
const LEGACY_DISTRICTS = Object.freeze([
  "Awaran",
  "Barkhan",
  "Chaghi",
  "Chaman",
  "Dera Bugti",
  "Duki",
  "Gawadar",
  "Harnai",
  "Hub",
  "Jafarabad",
  "Jhal Magsi",
  "Kachhi (Bolan)",
  "Kallat",
  "Karezat",
  "Kech (Turbat)",
  "Kharan",
  "Khuzdar",
  "Killa Abdullah",
  "Killa Saifullah",
  "Kohlu",
  "Lasbela",
  "Lehri",
  "Loralai",
  "Mastung",
  "Musa Khel",
  "Naseerabad",
  "Nushki",
  "Pishin",
  "Punjgur",
  "Quetta",
  "Sheerani",
  "Sibi",
  "Sohbatpur",
  "Surab",
  "Usta Mohammad",
  "Washuk",
  "Zhob",
  "Ziarat",
]);

const QUALIFICATION_OFFSET = 1;
const DISTRICT_OFFSET = 2;

const decodeWith = (list, offset) => (value) => {
  const clean = String(value ?? "").trim();
  if (!/^\d+$/.test(clean)) return value;
  return list[Number(clean) - offset] || value;
};

const decodeQualification = decodeWith(LEGACY_QUALIFICATIONS, QUALIFICATION_OFFSET);
const decodeDistrict = decodeWith(LEGACY_DISTRICTS, DISTRICT_OFFSET);

/**
 * Every (stored, meant) pair for one column - what the boot-time repair turns
 * into a single UPDATE.
 */
const legacyPairs = (list, offset) =>
  list.map((name, index) => [String(index + offset), name]);

module.exports = {
  LEGACY_QUALIFICATIONS,
  LEGACY_DISTRICTS,
  QUALIFICATION_OFFSET,
  DISTRICT_OFFSET,
  decodeQualification,
  decodeDistrict,
  legacyPairs,
};
