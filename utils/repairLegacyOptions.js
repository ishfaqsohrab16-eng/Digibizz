const { QueryTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const {
  LEGACY_QUALIFICATIONS,
  LEGACY_DISTRICTS,
  QUALIFICATION_OFFSET,
  DISTRICT_OFFSET,
  legacyPairs,
} = require("./legacyStudentOptions");

/**
 * Replace stored dropdown positions with the words they stood for, at boot.
 *
 * A student saved through the old form has "1" as a qualification and "2" as
 * a district, and every screen that reads the row - View, the enrolled list,
 * exports, the assistant - shows the number. Fixing the form stopped new
 * damage; it did not touch the rows already written, and editing one did not
 * help either, because the edit form faithfully offered "2" back.
 *
 * Run at startup rather than left as a script, because the damage is exact
 * and the repair is exact: every stored value maps to one name through the
 * frozen lists in legacyStudentOptions.js, and nothing about it needs a human
 * to decide. It is IDEMPOTENT - once a row says "Awaran" it no longer matches
 * - so every boot after the first finds nothing and says nothing.
 *
 * One UPDATE per column, with a CASE, rather than forty-eight round trips.
 * The column names are constants here, never input, so they are safe to put
 * in the statement; every value goes through a replacement.
 *
 * NEVER FATAL. A failure is logged and the server carries on: the numbers are
 * ugly, not dangerous, and the form and the write path both translate them
 * regardless.
 */

const caseUpdate = (column, pairs) => ({
  sql:
    `UPDATE students SET ${column} = CASE ${column} ` +
    pairs.map(() => "WHEN ? THEN ?").join(" ") +
    ` ELSE ${column} END WHERE ${column} IN (${pairs.map(() => "?").join(", ")})`,
  replacements: [...pairs.flat(), ...pairs.map(([stored]) => stored)],
});

const repairColumn = async (column, list, offset) => {
  const { sql, replacements } = caseUpdate(column, legacyPairs(list, offset));
  const result = await sequelize.query(sql, { replacements, type: QueryTypes.UPDATE });
  // mysql2 answers an UPDATE with [undefined, affectedRows].
  return Number(Array.isArray(result) ? result[1] : 0) || 0;
};

const repairLegacyOptions = async () => {
  try {
    const qualifications = await repairColumn(
      "std_qualification",
      LEGACY_QUALIFICATIONS,
      QUALIFICATION_OFFSET
    );
    const districts = await repairColumn("std_district", LEGACY_DISTRICTS, DISTRICT_OFFSET);

    if (qualifications + districts > 0) {
      console.log(
        `[repair] translated stored dropdown positions back to words: ` +
          `${qualifications} qualification(s), ${districts} district(s)`
      );
    }
    return { qualifications, districts };
  } catch (error) {
    console.error("[repair] could not translate legacy student options:", error?.message || error);
    return { qualifications: 0, districts: 0, error: error?.message || String(error) };
  }
};

module.exports = { repairLegacyOptions, _internals: { caseUpdate } };
