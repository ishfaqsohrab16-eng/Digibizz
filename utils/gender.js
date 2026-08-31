/**
 * One spelling of gender, whatever came in.
 *
 * The public registration form posts "male"/"female" in lower case, and the
 * candidates table stores exactly what it is given. The students table
 * validates against ["Male", "Female", "Other"]. Enrolling a candidate copies
 * one into the other, so every enrolment of a female applicant died on
 * `Validation isIn on std_gender failed` with the value "female" - correct
 * data, refused over its capitalisation.
 *
 * Fixing it at the point of copying would have left the same trap for the next
 * path that writes a student. So the canonical form is defined here and applied
 * by the model itself, which is the only place every writer has to pass through.
 *
 * Unrecognised values are returned unchanged rather than forced to "Other".
 * A genuinely wrong value should fail validation loudly, not be quietly
 * recorded as something the person did not say.
 */

/** The three values the students table accepts. */
const CANONICAL = ["Male", "Female", "Other"];

const ALIASES = new Map([
  ["m", "Male"],
  ["male", "Male"],
  ["man", "Male"],
  ["f", "Female"],
  ["female", "Female"],
  ["woman", "Female"],
  ["o", "Other"],
  ["other", "Other"],
]);

/**
 * @param {*} value anything a form, spreadsheet or database row might hold
 * @returns {*} "Male" | "Female" | "Other", or the input untouched
 */
const normaliseGender = (value) => {
  if (value === null || value === undefined) return value;

  const key = String(value).trim().toLowerCase();
  if (key === "") return value;

  return ALIASES.get(key) ?? value;
};

/**
 * Compare two genders without caring how either was spelled.
 *
 * Rows written before the normalisation existed still hold whatever they were
 * given, so a plain `=== "Male"` on historical data silently undercounts.
 */
const isGender = (value, expected) =>
  String(normaliseGender(value) ?? "").toLowerCase() ===
  String(expected ?? "").toLowerCase();

module.exports = { normaliseGender, isGender, CANONICAL };
