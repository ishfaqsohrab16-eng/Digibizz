-- Lets an admin author their own HTML for a campaign instead of using the
-- built-in interview letter. NULL means "use the built-in template", so
-- existing campaigns are unaffected.
--
-- Additive and nullable, so it is safe to apply before the code that uses it.
-- utils/ensureSchema.js also adds this column at startup if it is missing -
-- sequelize.sync({ alter: false }) never adds columns to an existing table,
-- and a model attribute without its column breaks every query against that
-- table, not just the new feature.
--
-- MySQL has no ADD COLUMN IF NOT EXISTS, so re-running this errors with
-- "Duplicate column name". That is harmless; check first if you need it to be
-- idempotent:
--
--   SELECT COUNT(*) FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE()
--      AND TABLE_NAME = 'email_campaigns'
--      AND COLUMN_NAME = 'ec_custom_html';

ALTER TABLE `email_campaigns`
  ADD COLUMN `ec_custom_html` LONGTEXT NULL DEFAULT NULL
  COMMENT 'Admin-authored HTML replacing the built-in letter; NULL = use the built-in template'
  AFTER `ec_message`;
