const { sequelize } = require("../config/db");

/**
 * Additive schema guards applied at startup.
 *
 * Why this exists: Sequelize selects every attribute declared on a model, so
 * the moment a new column is added to a model, EVERY query against that table
 * includes it. Deploying the code before the migration therefore doesn't just
 * break the new feature - it breaks unrelated reads. Adding `is_uob_student`
 * to the Candidate model took down `checkCandidateByCnic`, which is the public
 * "have I already applied?" check, so applicants could not register at all.
 *
 * Each entry here is additive and idempotent: a nullable column with no
 * default, added only when missing. Nothing is dropped, renamed or retyped,
 * and no data is written. Anything beyond that belongs in migration/ and
 * should be run deliberately.
 *
 * A failure here is logged loudly but never stops the server: if the database
 * user lacks ALTER rights, the operator gets an actionable message with the
 * exact SQL to run by hand.
 */
const REQUIRED_COLUMNS = [
  {
    table: "email_campaigns",
    column: "ec_audience",
    definition:
      "VARCHAR(20) NOT NULL DEFAULT 'candidates' COMMENT 'candidates | students'",
    migration: "migration/017_campaign_kinds_and_audiences.sql",
  },
  {
    table: "email_campaign_recipients",
    column: "std_id",
    definition:
      "INT NULL DEFAULT NULL COMMENT 'Set instead of cand_id for student-audience campaigns'",
    migration: "migration/017_campaign_kinds_and_audiences.sql",
  },
  {
    table: "activity_log",
    column: "act_actor_name",
    definition: "VARCHAR(150) NULL DEFAULT NULL COMMENT 'Name of whoever made the change'",
    migration: "migration/015_activity_log_change_tracking.sql",
  },
  {
    table: "activity_log",
    column: "act_entity",
    definition: "VARCHAR(100) NULL DEFAULT NULL COMMENT 'Model/table that changed'",
    migration: "migration/015_activity_log_change_tracking.sql",
  },
  {
    table: "activity_log",
    column: "act_entity_id",
    definition: "VARCHAR(100) NULL DEFAULT NULL COMMENT 'Primary key of the changed row'",
    migration: "migration/015_activity_log_change_tracking.sql",
  },
  {
    table: "activity_log",
    column: "act_summary",
    definition: "TEXT NULL DEFAULT NULL COMMENT 'Readable paragraph describing the change'",
    migration: "migration/015_activity_log_change_tracking.sql",
  },
  {
    table: "activity_log",
    column: "act_changes",
    definition: "LONGTEXT NULL DEFAULT NULL COMMENT 'JSON of field-level before/after values'",
    migration: "migration/015_activity_log_change_tracking.sql",
  },
  {
    table: "activity_log",
    column: "act_ip",
    definition: "VARCHAR(45) NULL DEFAULT NULL COMMENT 'IP the change came from'",
    migration: "migration/015_activity_log_change_tracking.sql",
  },
  {
    table: "students_feedback",
    column: "sf_week",
    definition:
      "VARCHAR(10) NULL DEFAULT NULL COMMENT 'ISO week key (2026-W34); one feedback per student per batch per week'",
    migration: "migration/014_feedback_once_per_week.sql",
  },
  {
    table: "earnings",
    column: "earning_reject_reason",
    definition:
      "TEXT NULL DEFAULT NULL COMMENT 'Why the submission was rejected; shown to the student'",
    migration: "migration/013_add_earning_review_fields.sql",
  },
  {
    table: "earnings",
    column: "earning_reviewed_by",
    definition:
      "INT NULL DEFAULT NULL COMMENT 'user_id of whoever approved or rejected this'",
    migration: "migration/013_add_earning_review_fields.sql",
  },
  {
    table: "earnings",
    column: "earning_reviewed_at",
    definition:
      "DATETIME NULL DEFAULT NULL COMMENT 'When it was approved or rejected'",
    migration: "migration/013_add_earning_review_fields.sql",
  },
  {
    table: "email_campaigns",
    column: "ec_custom_html",
    definition:
      "LONGTEXT NULL DEFAULT NULL COMMENT 'Admin-authored HTML replacing the built-in letter; NULL = use the built-in template'",
    migration: "migration/012_add_custom_html_to_email_campaigns.sql",
  },
  {
    table: "candidates",
    column: "is_uob_student",
    definition:
      "TINYINT(1) NULL DEFAULT NULL COMMENT 'Interviewer-verified University of Balochistan student: NULL=not asked, 0=no, 1=yes'",
    migration: "migration/009_add_is_uob_student_to_candidates.sql",
  },
];

const columnExists = async (table, column) => {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS total
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :table
        AND COLUMN_NAME = :column`,
    { replacements: { table, column } }
  );
  return Number(rows?.[0]?.total || 0) > 0;
};

const ensureSchema = async () => {
  for (const item of REQUIRED_COLUMNS) {
    try {
      if (await columnExists(item.table, item.column)) continue;

      // Identifiers come from the constant list above, never from user input.
      await sequelize.query(
        `ALTER TABLE \`${item.table}\` ADD COLUMN \`${item.column}\` ${item.definition}`
      );
      console.log(
        `[schema] added missing column ${item.table}.${item.column}`
      );
    } catch (error) {
      console.error(
        `[schema] COULD NOT ADD ${item.table}.${item.column}: ${error.message}\n` +
          `[schema] Queries against \`${item.table}\` will fail until this exists. Run it manually:\n` +
          `[schema]   ALTER TABLE \`${item.table}\` ADD COLUMN \`${item.column}\` ${item.definition};\n` +
          `[schema] (or apply ${item.migration})`
      );
    }
  }
};

module.exports = { ensureSchema, REQUIRED_COLUMNS };
