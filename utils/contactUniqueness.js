const { Op } = require("sequelize");
const Candidate = require("../models/CandidateModel");
const Student = require("../models/studentModel");
const User = require("../models/userModel");

/**
 * Is this email address or phone number already spoken for?
 *
 * Two different questions live here, and they have different answers:
 *
 *   REGISTERING as a candidate - is this already used by someone applying in
 *   THIS batch, or by anyone already enrolled? Previous batches are
 *   deliberately not consulted. Somebody who applied last year and was not
 *   selected is entitled to apply again with the same email and phone, and
 *   checking every batch ever ran refused exactly those people.
 *
 *   CREATING OR EDITING A STUDENT - is this already used by someone enrolled?
 *   Candidates are not consulted at all. A student being enrolled IS the
 *   candidate whose details these are, so checking applications would have
 *   every enrolment collide with itself.
 *
 * One definition, asked by the registration form as the applicant types, again
 * when they submit, by the enrolment path, and by the profile editor.
 */

/** Addresses only ever differ by case; store and compare in one of them. */
const normaliseEmail = (value) => String(value ?? "").trim().toLowerCase();

/**
 * Phone numbers are written a dozen ways for the same line: 0300-1234567,
 * 03001234567, +92 300 1234567. Comparing the digits is the only way to catch
 * a duplicate that a person would recognise as one.
 *
 * The last nine digits are compared rather than all of them, so a local
 * 03001234567 and an international +923001234567 are recognised as the same
 * number - which they are.
 */
const phoneKey = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length > 9 ? digits.slice(-9) : digits;
};

/**
 * Narrow to rows worth comparing properly.
 *
 * A LIKE on the whole key does NOT work: the column holds whatever the person
 * typed, so `%001234567` never matches the stored `0300-1234567` - the dash is
 * in the way. That silently found no duplicates at all, which is the worst way
 * for a uniqueness check to fail.
 *
 * The last four digits are used instead. They are contiguous in every way a
 * number is written - nobody puts a separator inside the final block - so this
 * matches regardless of formatting, cuts the table down to a handful of rows,
 * and leaves the real comparison to phoneKey, where the formatting can
 * actually be stripped.
 */
const PHONE_NARROW_DIGITS = 4;

/**
 * How many same-ending rows to compare properly.
 *
 * Four digits is one in ten thousand numbers; a cap this size will never be
 * reached in practice and stops a pathological column from loading a table.
 */
const PHONE_CANDIDATE_LIMIT = 50;

const phoneMatches = (key) => ({
  [Op.like]: `%${key.slice(-PHONE_NARROW_DIGITS)}`,
});

/** The comparison that decides it, once the formatting is gone. */
const samePhone = (stored, key) => Boolean(key) && phoneKey(stored) === key;

/** A phone shorter than this is a typo, not a number; it would match half the table. */
const MIN_PHONE_DIGITS = 7;

/** Removed students do not hold a place, so they do not hold their details either. */
const LIVE_STUDENT = { std_lms_status: { [Op.ne]: 2 } };

/**
 * One sentence covering however many conflicts there are.
 *
 * Written out rather than joined mechanically, because "That email address is
 * already registered. That phone number is already registered." reads like a
 * fault, and the applicant has to be told plainly what to change.
 */
const describeConflicts = (conflicts) => {
  const fields = conflicts.map((conflict) => conflict.field);

  if (fields.includes("email") && fields.includes("phone")) {
    return (
      "That email address and phone number are both already registered. " +
      "Please use a different email address and a different phone number."
    );
  }
  if (fields.includes("email")) {
    return "That email address is already registered. Please use a different one.";
  }
  if (fields.includes("phone")) {
    return "That phone number is already registered. Please use a different one.";
  }
  return "";
};

/**
 * Is this email on an ENROLLED student's account?
 *
 * Two steps rather than a join, because there is no User->Student association
 * defined and adding one to answer a yes/no question is a lot of blast radius.
 * The email column is unique, so the first query returns at most one row.
 *
 * Note this asks about students specifically, not about users. A trainer or an
 * administrator holding the address does not block an applicant.
 */
const emailBelongsToStudent = async (email, ignore) => {
  const user = await User.findOne({
    where: {
      user_email: email,
      ...(ignore.user_id ? { user_id: { [Op.ne]: ignore.user_id } } : {}),
    },
    attributes: ["user_id"],
  });
  if (!user) return false;

  const student = await Student.findOne({
    where: {
      user_id: user.user_id,
      ...LIVE_STUDENT,
      ...(ignore.std_id ? { std_id: { [Op.ne]: ignore.std_id } } : {}),
    },
    attributes: ["std_id"],
  });

  return Boolean(student);
};

/** Is this email on an application in the given batch? */
const emailBelongsToCandidate = async (email, tb_id, ignore) => {
  const candidate = await Candidate.findOne({
    where: {
      cand_email: email,
      tb_id,
      ...(ignore.cand_id ? { cand_id: { [Op.ne]: ignore.cand_id } } : {}),
    },
    attributes: ["cand_id"],
  });
  return Boolean(candidate);
};

const phoneBelongsToStudent = async (key, ignore) => {
  const students = await Student.findAll({
    where: {
      std_phone: phoneMatches(key),
      ...LIVE_STUDENT,
      ...(ignore.std_id ? { std_id: { [Op.ne]: ignore.std_id } } : {}),
    },
    attributes: ["std_id", "std_phone"],
    limit: PHONE_CANDIDATE_LIMIT,
  });
  return students.some((row) => samePhone(row.std_phone, key));
};

const phoneBelongsToCandidate = async (key, tb_id, ignore) => {
  const candidates = await Candidate.findAll({
    where: {
      cand_phone: phoneMatches(key),
      tb_id,
      ...(ignore.cand_id ? { cand_id: { [Op.ne]: ignore.cand_id } } : {}),
    },
    attributes: ["cand_id", "cand_phone"],
    limit: PHONE_CANDIDATE_LIMIT,
  });
  return candidates.some((row) => samePhone(row.cand_phone, key));
};

/**
 * Every conflict, not just the first.
 *
 * An applicant whose email AND phone are both taken was told about the email,
 * changed it, and was then told about the phone - two rounds of a six-step form
 * for something that could have been said once.
 *
 * @param {object} contact
 * @param {string} [contact.email]
 * @param {string} [contact.phone]
 * @param {object} [options]
 * @param {number|string|null} [options.candidatesInBatch] check applications in
 *   this batch, and only this batch. Omit to skip applications entirely.
 * @param {boolean} [options.students] check people already enrolled. Default true.
 * @param {object} [options.ignore] rows belonging to the person being edited.
 * @returns {Promise<{conflicts: Array<{field: string, message: string}>,
 *   fields: string[], message: string}>}
 */
const findContactConflicts = async (contact, options = {}) => {
  const {
    candidatesInBatch = null,
    students = true,
    ignore = {},
  } = options;

  const email = normaliseEmail(contact.email);
  const key = phoneKey(contact.phone);
  const checkPhone = key.length >= MIN_PHONE_DIGITS;

  const [
    emailOnStudent,
    emailOnCandidate,
    phoneOnStudent,
    phoneOnCandidate,
  ] = await Promise.all([
    email && students ? emailBelongsToStudent(email, ignore) : false,
    email && candidatesInBatch
      ? emailBelongsToCandidate(email, candidatesInBatch, ignore)
      : false,
    checkPhone && students ? phoneBelongsToStudent(key, ignore) : false,
    checkPhone && candidatesInBatch
      ? phoneBelongsToCandidate(key, candidatesInBatch, ignore)
      : false,
  ]);

  const conflicts = [];
  if (emailOnStudent || emailOnCandidate) {
    conflicts.push({
      field: "email",
      message:
        "That email address is already registered. Please use a different one.",
      where: emailOnStudent ? "student" : "candidate",
    });
  }
  if (phoneOnStudent || phoneOnCandidate) {
    conflicts.push({
      field: "phone",
      message:
        "That phone number is already registered. Please use a different one.",
      where: phoneOnStudent ? "student" : "candidate",
    });
  }

  return {
    conflicts,
    fields: conflicts.map((conflict) => conflict.field),
    message: describeConflicts(conflicts),
  };
};

/** The first conflict, for callers that only need to refuse. */
const findContactConflict = async (contact, options = {}) => {
  const { conflicts } = await findContactConflicts(contact, options);
  return conflicts[0] || null;
};

/**
 * Registering an application.
 *
 * This batch's applicants and everyone already enrolled. Previous batches are
 * not consulted: somebody who applied last year and was not selected may apply
 * again with the same details, and they were being refused for it.
 */
const registrationConflicts = (contact, tb_id, ignore = {}) =>
  findContactConflicts(contact, {
    candidatesInBatch: tb_id,
    students: true,
    ignore,
  });

/**
 * Creating, enrolling or editing a student.
 *
 * Enrolled students only. A candidate being enrolled IS the person whose
 * details these are, so consulting applications would make every enrolment
 * collide with itself.
 */
const studentContactConflicts = (contact, ignore = {}) =>
  findContactConflicts(contact, {
    candidatesInBatch: null,
    students: true,
    ignore,
  });

module.exports = {
  findContactConflict,
  findContactConflicts,
  registrationConflicts,
  studentContactConflicts,
  describeConflicts,
  normaliseEmail,
  phoneKey,
  samePhone,
};
