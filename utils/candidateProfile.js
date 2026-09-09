/**
 * What a student record inherits from the candidate record it came from.
 *
 * Enrolling copies an applicant's details onto their new student row. Which
 * candidate column feeds which student column was written out inline in the
 * enrolment path and nowhere else, so a backfill correcting old rows had no
 * way to agree with it except by copying the same two lines - and two copies
 * of a mapping are two mappings, which drift.
 *
 * NO GUESSING BETWEEN COLUMNS. Domicile is not the current city, and the area
 * of a degree is not its level; a fallback between them would fill a blank
 * with something plausible and wrong, which is worse than the blank, because a
 * blank is visibly missing and a wrong district is not. So each field has one
 * source, and when that source is empty the answer is "nothing to copy".
 */

/** Trimmed text, with null, undefined and the strings they stringify to gone. */
const text = (value) => {
  const clean = String(value ?? "").trim();
  // Sequelize hands back real nulls, but data imported through a spreadsheet
  // has arrived carrying the WORD null before now.
  return clean === "null" || clean === "undefined" ? "" : clean;
};

/** True when a stored value carries no information. */
const isBlank = (value) => text(value) === "";

/**
 * The applicant's district.
 *
 * cand_local_domicile is the field the registration form labels "District",
 * and it is what the Interview Portal shows as domicile.
 */
const districtOf = (candidate) => text(candidate?.cand_local_domicile);

/**
 * The applicant's qualification.
 *
 * cand_degree_level - the LEVEL ("Bachelors"), which is what the student
 * record means by qualification. degree_area is the subject and is
 * deliberately not used in its place.
 */
const qualificationOf = (candidate) => text(candidate?.cand_degree_level);

/**
 * Everything a student row takes from a candidate, as one object.
 *
 * Blank fields are omitted rather than written as "". A caller filling in gaps
 * can then spread this over a record without a missing candidate field
 * quietly overwriting a student value that somebody typed in by hand.
 */
const profileFromCandidate = (candidate) => {
  const values = {};

  const district = districtOf(candidate);
  if (district) values.std_district = district;

  const qualification = qualificationOf(candidate);
  if (qualification) values.std_qualification = qualification;

  return values;
};

/**
 * Which of these a candidate cannot supply, by student column name.
 *
 * Used to say so at enrolment: a student created with no district is a gap
 * somebody will hit later, and naming it as it happens is cheaper than
 * finding it months afterwards in a report.
 */
const missingFromCandidate = (candidate) =>
  [
    isBlank(districtOf(candidate)) ? "std_district" : null,
    isBlank(qualificationOf(candidate)) ? "std_qualification" : null,
  ].filter(Boolean);

module.exports = {
  text,
  isBlank,
  districtOf,
  qualificationOf,
  profileFromCandidate,
  missingFromCandidate,
};
