const { Op } = require("sequelize");
const Candidate = require("../models/CandidateModel");
const Student = require("../models/studentModel");
const User = require("../models/userModel");

/**
 * Is this email address or phone number already spoken for?
 *
 * Three tables can hold the same person's contact details - user, student and
 * candidate - and until now only some of them were checked, in some of the
 * places that write them. The result was a registration that looked fine right
 * up to the insert, where the database refused it and the applicant got a 500
 * with the word "Sequelize" in it.
 *
 * One definition, asked by the registration form as the applicant types, again
 * when they submit, and by the profile editor. All three give the same answer,
 * which is the point.
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
 * A LIKE on the whole key does NOT work: the column holds whatever the
 * person typed, so `%001234567` never matches the stored `0300-1234567` -
 * the dash is in the way. That silently found no duplicates at all, which
 * is the worst way for a uniqueness check to fail.
 *
 * The last four digits are used instead. They are contiguous in every way a
 * number is written - nobody puts a separator inside the final block - so
 * this matches regardless of formatting, cuts the table down to a handful of
 * rows, and leaves the real comparison to phoneKey below, where the
 * formatting can actually be stripped.
 */
const PHONE_NARROW_DIGITS = 4;

/**
 * How many same-ending rows to compare properly.
 * Four digits is one in ten thousand numbers; a cap this size will never be
 * reached in practice and stops a pathological column from loading a table.
 */
const PHONE_CANDIDATE_LIMIT = 50;

const phoneMatches = (key) => ({
  [Op.like]: `%${key.slice(-PHONE_NARROW_DIGITS)}`,
});

/** The comparison that decides it, once the formatting is gone. */
const samePhone = (stored, key) => Boolean(key) && phoneKey(stored) === key;

/**
 * @param {object} contact
 * @param {string} [contact.email]
 * @param {string} [contact.phone]
 * @param {object} [ignore] rows belonging to the person being edited
 * @param {number} [ignore.user_id]
 * @param {number} [ignore.cand_id]
 * @param {number} [ignore.std_id]
 * @returns {Promise<{field: string, message: string}|null>}
 */
const findContactConflict = async (contact, ignore = {}) => {
  const email = normaliseEmail(contact.email);
  const key = phoneKey(contact.phone);

  if (email) {
    const [user, candidate] = await Promise.all([
      User.findOne({
        where: {
          user_email: email,
          ...(ignore.user_id ? { user_id: { [Op.ne]: ignore.user_id } } : {}),
        },
        attributes: ["user_id"],
      }),
      Candidate.findOne({
        where: {
          cand_email: email,
          ...(ignore.cand_id ? { cand_id: { [Op.ne]: ignore.cand_id } } : {}),
        },
        attributes: ["cand_id"],
      }),
    ]);

    if (user || candidate) {
      return {
        field: "email",
        message:
          "That email address is already registered. Please use a different one.",
      };
    }
  }

  // A phone number shorter than this is a typo, not a number, and matching on
  // it would collide with half the table.
  if (key.length >= 7) {
    // findAll, not findOne: the LIKE above only narrows by the last four
    // digits, so the first row it happens to return may be a different
    // number that merely ends the same way. The rows are then compared
    // properly, with the formatting stripped.
    const [candidates, students] = await Promise.all([
      Candidate.findAll({
        where: {
          cand_phone: phoneMatches(key),
          ...(ignore.cand_id ? { cand_id: { [Op.ne]: ignore.cand_id } } : {}),
        },
        attributes: ["cand_id", "cand_phone"],
        limit: PHONE_CANDIDATE_LIMIT,
      }),
      Student.findAll({
        where: {
          std_phone: phoneMatches(key),
          ...(ignore.std_id ? { std_id: { [Op.ne]: ignore.std_id } } : {}),
        },
        attributes: ["std_id", "std_phone"],
        limit: PHONE_CANDIDATE_LIMIT,
      }),
    ]);

    const taken =
      candidates.some((row) => samePhone(row.cand_phone, key)) ||
      students.some((row) => samePhone(row.std_phone, key));

    if (taken) {
      return {
        field: "phone",
        message:
          "That phone number is already registered. Please use a different one.",
      };
    }
  }

  return null;
};

module.exports = {
  findContactConflict,
  normaliseEmail,
  phoneKey,
  samePhone,
};
