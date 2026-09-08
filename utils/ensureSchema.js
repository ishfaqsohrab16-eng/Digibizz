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
    // The weekly M&E report was first deployed keyed on (trainer, week) and
    // then corrected to (trainer, BATCH, week) - a trainer running classes in
    // two batches is doing two separable jobs. The table already existed by
    // then, and sync({alter:false}) never adds a column to an existing table,
    // so the model had a tb_id the database did not:
    //
    //   ER_KEY_COLUMN_DOES_NOT_EXITS: Key column 'tb_id' doesn't exist in table
    //   ALTER TABLE weekly_evaluations ADD UNIQUE INDEX ... (t_id, tb_id, ...)
    //
    // which failed sync, failed initializeDatabase, and crash-looped the whole
    // server - not just this module.
    //
    // DEFAULT 0 so the ALTER succeeds whatever is already stored. A report
    // written in the few hours the first version was live would land on batch
    // 0, which matches no batch and is therefore visibly orphaned rather than
    // silently attached to the wrong one.
    table: "weekly_evaluations",
    column: "tb_id",
    definition:
      "INT NOT NULL DEFAULT 0 COMMENT 'The batch this report covers. Part of the one-per-week key.'",
    migration: "migration/027_weekly_evaluations_batch.sql",
  },
  {
    table: "assignments",
    column: "as_group_id",
    definition:
      "VARCHAR(36) NULL DEFAULT NULL COMMENT 'Ties together the copies set for each of a trainer classes'",
    migration: "migration/023_assignment_group_id.sql",
  },
  {
    table: "email_campaign_recipients",
    column: "ecr_merge_data",
    definition:
      "TEXT NULL DEFAULT NULL COMMENT 'JSON of extra columns from an uploaded list, offered as merge tokens'",
    migration: "migration/018_campaign_uploaded_lists.sql",
  },
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

/**
 * ENUM columns whose allowed values have grown since the table was created.
 *
 * Adding a column is not the only additive change a deploy can need. When a new
 * value is introduced - ec_kind gaining 'general', ec_audience gaining 'list' -
 * MySQL does not reject the INSERT with a readable message; in non-strict mode
 * it fails with "Data truncated for column 'ec_kind' at row 1", which reads
 * like a length problem and says nothing about the missing value. That is
 * exactly what blocked every "general" campaign from being created.
 *
 * migration/017 and migration/018 carry these same statements, but both note
 * that ensureSchema does not apply ENUM changes - so on any deployment that has
 * never had the migration files run by hand, the column silently lags the
 * model. Widening an ENUM is additive and safe: existing rows keep their
 * values, nothing is dropped or retyped.
 *
 * Only widened when the column really is an ENUM and is really missing a value.
 * A permissive type (VARCHAR, say) already accepts everything and is left
 * alone, so this never narrows a column.
 */
const REQUIRED_ENUM_VALUES = [
  {
    table: "email_campaigns",
    column: "ec_kind",
    values: ["initial", "reminder", "recommendation", "general"],
    definition:
      "ENUM('initial','reminder','recommendation','general') NOT NULL DEFAULT 'initial'",
    migration: "migration/017_campaign_kinds_and_audiences.sql",
  },
  {
    table: "email_campaigns",
    column: "ec_audience",
    values: ["candidates", "students", "list"],
    definition:
      "ENUM('candidates','students','list') NOT NULL DEFAULT 'candidates' COMMENT 'candidates | students | list (uploaded spreadsheet)'",
    migration: "migration/018_campaign_uploaded_lists.sql",
  },
];

/**
 * Indexes that must NOT exist any more.
 *
 * The counterpart of REQUIRED_COLUMNS, and rarer: an index is usually additive
 * and harmless, so this is only for one that has become actively wrong.
 *
 * Dropping is safe in a way that creating is not - an index carries no data,
 * and the worst case of dropping one that has already gone is nothing at all.
 * A UNIQUE index that is wrong, on the other hand, silently refuses correct
 * writes, and that is a bug nobody attributes to a leftover index.
 */
const FORBIDDEN_INDEXES = [
  {
    table: "weekly_evaluations",
    index: "weekly_evaluations_trainer_week",
    reason:
      "it allowed one report per trainer per week across ALL batches, so a " +
      "trainer teaching in two batches could only ever be evaluated for one",
    migration: "migration/027_weekly_evaluations_batch.sql",
  },
];

/**
 * Columns whose type is too small for what people actually put in them.
 *
 * sequelize.sync({alter:false}) creates missing tables but never reconciles a
 * column that already exists, so widening one in the model changes nothing on
 * a deployed database. The failure is silent until someone writes a long
 * sentence and loses their work.
 *
 * Only ever WIDENS. The check is on the current type, so a column already at
 * TEXT is left alone and one at VARCHAR is enlarged; nothing is ever narrowed,
 * and no data can be truncated by running this.
 */
const REQUIRED_WIDER_COLUMNS = [
  {
    table: "daily_lecture_reports",
    column: "dlr_challenges",
    // Anything that is not already a *TEXT/BLOB type is too small.
    tooSmall: (type) => !/text|blob/i.test(type),
    definition: "TEXT NOT NULL",
    reason:
      "a trainer describing a lecture wrote 340 characters into a VARCHAR(255) " +
      "and the whole daily report was rejected",
    migration: "migration/024_widen_lecture_report_challenges.sql",
  },
];

/**
 * Columns that must accept NULL.
 *
 * The email module was admissions-only: a campaign required a center and a
 * batch, and a recipient required a candidate. It is now a standalone mailing
 * tool whose recipients are addresses from a spreadsheet, so all of those are
 * optional. Until they are, creating a list campaign fails - either on
 * email_campaigns.center_id or, one step later and far more confusingly, on
 * email_campaign_recipients.cand_id.
 *
 * Relaxing NOT NULL is additive in the same sense as adding a column: no
 * existing row changes, and nothing that was valid before becomes invalid.
 * Narrowing is never done here.
 *
 * migration/019_email_module_list_only.sql is the same change written out.
 */
const REQUIRED_NULLABLE_COLUMNS = [
  // The audit log's scope columns. A change is tagged with the course, centre
  // and batch it belongs to, and most changes belong to none of them - a
  // document upload, a user's own profile - so all three are nullable in the
  // model. The deployed table was created before that and still says NOT NULL,
  // which sync({alter:false}) will never reconcile.
  //
  // The result is a log line per save, for every save, of every model that has
  // no course:
  //
  //   [audit] could not record updated on StudentsDocs: Column 'course_id'
  //   cannot be null
  //
  // The operation itself survives - auditing is deliberately non-fatal - but
  // the change goes unrecorded, which is the one thing an audit log must not
  // do quietly.
  {
    table: "activity_log",
    column: "course_id",
    definition:
      "INT NULL DEFAULT NULL COMMENT 'Course this change belongs to, when it belongs to one.'",
  },
  {
    table: "activity_log",
    column: "center_id",
    definition:
      "INT NULL DEFAULT NULL COMMENT 'Centre this change belongs to, when it belongs to one.'",
  },
  {
    table: "activity_log",
    column: "tb_id",
    definition:
      "INT NULL DEFAULT NULL COMMENT 'Batch this change belongs to, when it belongs to one.'",
  },
  {
    table: "email_campaigns",
    column: "tb_id",
    definition:
      "INT NULL DEFAULT NULL COMMENT 'Legacy: batch a campaign was scoped to. NULL for list campaigns.'",
  },
  {
    table: "email_campaigns",
    column: "center_id",
    definition:
      "INT NULL DEFAULT NULL COMMENT 'Legacy: center a campaign was scoped to. NULL for list campaigns.'",
  },
  {
    table: "email_campaigns",
    column: "ec_kind",
    definition:
      "ENUM('initial','reminder','recommendation','general') NULL DEFAULT NULL COMMENT 'Legacy campaign kind. NULL for list campaigns.'",
  },
  {
    table: "email_campaigns",
    column: "ec_audience",
    definition:
      "ENUM('candidates','students','list') NULL DEFAULT NULL COMMENT 'Legacy audience. NULL for list campaigns.'",
  },
  {
    table: "email_campaign_recipients",
    column: "cand_id",
    definition:
      "INT NULL DEFAULT NULL COMMENT 'Legacy: candidate behind this address. NULL for list recipients.'",
  },
  {
    table: "email_campaign_recipients",
    column: "course_id",
    definition:
      "INT NULL DEFAULT NULL COMMENT 'Legacy: course used for per-course quota reporting.'",
  },
];

const isNullable = async (table, column) => {
  const [rows] = await sequelize.query(
    `SELECT IS_NULLABLE AS nullable
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :table
        AND COLUMN_NAME = :column`,
    { replacements: { table, column } }
  );
  if (!rows?.length) return null; // column absent
  return String(rows[0].nullable).toUpperCase() === "YES";
};

const ensureNullableColumns = async () => {
  for (const item of REQUIRED_NULLABLE_COLUMNS) {
    try {
      const nullable = await isNullable(item.table, item.column);

      // Absent entirely, or already nullable - nothing to do. Checking first
      // keeps startup quiet on a database that is already correct.
      if (nullable === null || nullable === true) continue;

      await sequelize.query(
        `ALTER TABLE \`${item.table}\` MODIFY COLUMN \`${item.column}\` ${item.definition}`
      );
      console.log(`[schema] ${item.table}.${item.column} now accepts NULL`);
    } catch (error) {
      console.error(
        `[schema] COULD NOT RELAX ${item.table}.${item.column}: ${error.message}\n` +
          `[schema] Creating a list campaign will fail until this runs:\n` +
          `[schema]   ALTER TABLE \`${item.table}\` MODIFY COLUMN \`${item.column}\` ${item.definition};\n` +
          `[schema] (or apply migration/019_email_module_list_only.sql)`
      );
    }
  }
};

const getColumnType = async (table, column) => {
  const [rows] = await sequelize.query(
    `SELECT COLUMN_TYPE AS type
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :table
        AND COLUMN_NAME = :column`,
    { replacements: { table, column } }
  );
  return rows?.[0]?.type || null;
};

const indexExists = async (table, index) => {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*) AS present
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = :table
        AND INDEX_NAME = :index`,
    { replacements: { table, index } }
  );
  return Number(rows?.[0]?.present) > 0;
};

const dropForbiddenIndexes = async () => {
  for (const item of FORBIDDEN_INDEXES) {
    try {
      // Checked first, because DROP INDEX on one that is not there is an error
      // and would fill the log on every boot forever.
      if (!(await indexExists(item.table, item.index))) continue;

      await sequelize.query(
        `ALTER TABLE \`${item.table}\` DROP INDEX \`${item.index}\``
      );
      console.log(`[schema] dropped ${item.table}.${item.index} - ${item.reason}`);
    } catch (error) {
      console.error(
        `[schema] COULD NOT DROP INDEX ${item.table}.${item.index}: ${error.message}\n` +
          `[schema] It is still in place, and ${item.reason}.\n` +
          `[schema] Run it manually:\n` +
          `[schema]   ALTER TABLE \`${item.table}\` DROP INDEX \`${item.index}\`;\n` +
          `[schema] (or apply ${item.migration})`
      );
    }
  }
};

const ensureWiderColumns = async () => {
  for (const item of REQUIRED_WIDER_COLUMNS) {
    try {
      const columnType = await getColumnType(item.table, item.column);

      // Absent entirely, or already big enough. Checking first keeps startup
      // quiet on a database that is already correct.
      if (!columnType || !item.tooSmall(columnType)) continue;

      await sequelize.query(
        `ALTER TABLE \`${item.table}\` MODIFY COLUMN \`${item.column}\` ${item.definition}`
      );
      console.log(
        `[schema] widened ${item.table}.${item.column} from ${columnType} to ${item.definition}`
      );
    } catch (error) {
      console.error(
        `[schema] COULD NOT WIDEN ${item.table}.${item.column}: ${error.message}\n` +
          `[schema] Saving will fail with "Data too long for column '${item.column}'" - ${item.reason}.\n` +
          `[schema] Run it manually:\n` +
          `[schema]   ALTER TABLE \`${item.table}\` MODIFY COLUMN \`${item.column}\` ${item.definition};\n` +
          `[schema] (or apply ${item.migration})`
      );
    }
  }
};

const ensureEnumValues = async () => {
  for (const item of REQUIRED_ENUM_VALUES) {
    try {
      const columnType = await getColumnType(item.table, item.column);

      // Column missing entirely: REQUIRED_COLUMNS above owns creating it.
      if (!columnType) continue;

      // Not an ENUM, so it does not constrain values. Leave it be - replacing a
      // VARCHAR with an ENUM could truncate a value already stored there.
      if (!/^enum\(/i.test(columnType)) continue;

      const missing = item.values.filter(
        (value) => !columnType.includes(`'${value}'`)
      );
      if (!missing.length) continue;

      await sequelize.query(
        `ALTER TABLE \`${item.table}\` MODIFY COLUMN \`${item.column}\` ${item.definition}`
      );
      console.log(
        `[schema] widened ${item.table}.${item.column} to allow ${missing.join(", ")}`
      );
    } catch (error) {
      console.error(
        `[schema] COULD NOT WIDEN ${item.table}.${item.column}: ${error.message}\n` +
          `[schema] Creating a campaign will fail with "Data truncated for column '${item.column}'" until this runs:\n` +
          `[schema]   ALTER TABLE \`${item.table}\` MODIFY COLUMN \`${item.column}\` ${item.definition};\n` +
          `[schema] (or apply ${item.migration})`
      );
    }
  }
};

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

  // Order matters. Columns must exist before their type can be reconciled, and
  // the ENUMs are widened before NOT NULL is relaxed so the second MODIFY
  // carries the full value list rather than re-narrowing what the first fixed.
  await ensureEnumValues();
  await ensureWiderColumns();
  await ensureNullableColumns();

  // Last. The columns a replacement index needs have to exist first, and
  // sync() runs after all of this to create the replacement itself.
  await dropForbiddenIndexes();
};

module.exports = {
  ensureSchema,
  REQUIRED_COLUMNS,
  FORBIDDEN_INDEXES,
  REQUIRED_ENUM_VALUES,
  REQUIRED_WIDER_COLUMNS,
  REQUIRED_NULLABLE_COLUMNS,
  _internals: { dropForbiddenIndexes, indexExists },
};
