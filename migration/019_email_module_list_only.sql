-- Makes the email module a standalone mailing tool.
--
-- The module began as an admissions feature: a campaign belonged to a center
-- and a batch, and its recipients were candidates or enrolled students resolved
-- out of those tables. It is now one thing only - upload a list of addresses
-- and send them a message - so every column that tied a campaign to admissions
-- becomes optional.
--
-- NOTHING IS DROPPED. Existing campaigns keep their center, batch, kind and
-- audience so old runs still read correctly on the detail screen; the columns
-- are simply no longer required for new ones. Dropping them would destroy the
-- history of every campaign already sent, which is not worth the tidiness.
--
-- Safe to re-run: every statement here is idempotent in effect (re-applying the
-- same MODIFY is a no-op), except the CREATE INDEX at the end, which errors
-- with "Duplicate key name" - harmless.
--
-- ensureSchema applies these same relaxations at startup, so a deployment that
-- never runs migration files by hand still converges. This file is the record
-- of intent and the thing to run if the application lacks ALTER rights.

-- ---------------------------------------------------------------------------
-- 1. A campaign no longer belongs to a center or a batch.
-- ---------------------------------------------------------------------------
-- Both were NOT NULL. A list campaign is addressed to a spreadsheet, not to a
-- center's applicants, so requiring one forced operators to pick a meaningless
-- value - and because the compose screen only showed the selector for the
-- non-list flows, a list campaign could not be created at all.
ALTER TABLE `email_campaigns`
  MODIFY COLUMN `tb_id` INT NULL DEFAULT NULL
    COMMENT 'Legacy: batch a campaign was scoped to. NULL for list campaigns.',
  MODIFY COLUMN `center_id` INT NULL DEFAULT NULL
    COMMENT 'Legacy: center a campaign was scoped to. NULL for list campaigns.';

-- ---------------------------------------------------------------------------
-- 2. Kind and audience become historical.
-- ---------------------------------------------------------------------------
-- There is one kind of campaign now. These stay for old rows, but new ones
-- write NULL. They are also widened first: a database that never had migration
-- 017 applied has ec_kind ENUM('initial','reminder') only, and inserting
-- 'general' failed with "Data truncated for column 'ec_kind' at row 1" - a
-- message that names a length problem and never mentions the missing value.
ALTER TABLE `email_campaigns`
  MODIFY COLUMN `ec_kind`
    ENUM('initial','reminder','recommendation','general') NULL DEFAULT NULL
    COMMENT 'Legacy campaign kind. NULL for list campaigns.',
  MODIFY COLUMN `ec_audience`
    ENUM('candidates','students','list') NULL DEFAULT NULL
    COMMENT 'Legacy audience. NULL for list campaigns.';

-- ---------------------------------------------------------------------------
-- 3. A recipient is an address, not a person in this database.
-- ---------------------------------------------------------------------------
-- cand_id was NOT NULL until migration 017. On any database where 017 was
-- never applied, inserting a list recipient - which has no candidate behind it
-- - fails outright. std_id and ecr_merge_data are added by ensureSchema when
-- missing; this only relaxes what is already there.
ALTER TABLE `email_campaign_recipients`
  MODIFY COLUMN `cand_id` INT NULL DEFAULT NULL
    COMMENT 'Legacy: candidate behind this address. NULL for list recipients.',
  MODIFY COLUMN `course_id` INT NULL DEFAULT NULL
    COMMENT 'Legacy: course used for per-course quota reporting.';

-- Addresses are looked up per campaign when de-duplicating an upload against
-- what is already queued.
--
-- Deliberately NOT unique. Two different candidates in an OLD campaign can
-- legitimately share one address - families do - so a unique index would fail
-- to build on existing data and block the whole migration. Duplicates inside a
-- new upload are removed by the parser and again on insert.
CREATE INDEX `email_campaign_recipients_ec_email`
  ON `email_campaign_recipients` (`ec_id`, `ecr_email`);
