-- Rejection reason for earning submissions, plus who reviewed and when.
--
-- A rejection with no stated reason is not actionable: the student resubmits
-- the same thing and it is rejected again. The API now requires a reason
-- whenever a submission is rejected, and shows it to the student.
--
-- All three columns are additive and nullable, so this is safe to apply before
-- the code that uses them. utils/ensureSchema.js also adds them at startup if
-- missing - sequelize.sync({ alter: false }) never adds columns to an existing
-- table, and a model attribute without its column breaks every query against
-- that table, not just the new feature.
--
-- MySQL has no ADD COLUMN IF NOT EXISTS, so re-running this errors with
-- "Duplicate column name". That is harmless; check information_schema.COLUMNS
-- first if you need it to be idempotent.

ALTER TABLE `earnings`
  ADD COLUMN `earning_reject_reason` TEXT NULL DEFAULT NULL
    COMMENT 'Why the submission was rejected; shown to the student'
    AFTER `earning_status`,
  ADD COLUMN `earning_reviewed_by` INT NULL DEFAULT NULL
    COMMENT 'user_id of whoever approved or rejected this'
    AFTER `earning_reject_reason`,
  ADD COLUMN `earning_reviewed_at` DATETIME NULL DEFAULT NULL
    COMMENT 'When it was approved or rejected'
    AFTER `earning_reviewed_by`;
