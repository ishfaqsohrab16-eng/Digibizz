-- Add weekly_evaluations.tb_id, and drop the index that predates it.
--
-- The weekly M&E report was first deployed keyed on (trainer, week) and then
-- corrected to (trainer, BATCH, week): a trainer running classes in two
-- batches is doing two separable jobs, with different students, dates and
-- curriculum, and owes a report for each.
--
-- The table already existed by then. sequelize.sync({alter:false}) never adds
-- a column to an existing table, so the model had a tb_id the database did
-- not, and sync died trying to index it:
--
--   ER_KEY_COLUMN_DOES_NOT_EXITS (1072): Key column 'tb_id' doesn't exist in table
--   ALTER TABLE `weekly_evaluations`
--     ADD UNIQUE INDEX `weekly_evaluations_trainer_batch_week` (`t_id`, `tb_id`, `we_week_key`)
--
-- That failed initializeDatabase and crash-looped the whole server, not just
-- this module.
--
-- utils/ensureSchema.js applies both statements automatically on startup, in
-- that order and before sync() runs; this file is for a database that is
-- updated by hand.
--
-- DEFAULT 0 so the ALTER succeeds whatever is already stored. A report written
-- during the few hours the first version was live lands on batch 0, which
-- matches no real batch and is therefore visibly orphaned rather than silently
-- attached to the wrong one. Check for any before assuming there are none:
--
--   SELECT we_id, t_id, we_week_key FROM weekly_evaluations WHERE tb_id = 0;

ALTER TABLE `weekly_evaluations`
  ADD COLUMN `tb_id` INT NOT NULL DEFAULT 0
    COMMENT 'The batch this report covers. Part of the one-per-week key.';

-- The old key allowed one report per trainer per week across ALL batches, so a
-- trainer teaching in two could only ever be evaluated for one of them. It has
-- to go before the replacement can mean anything.
--
-- MySQL has no DROP INDEX IF EXISTS. On a database that never ran the first
-- version this statement errors with "check that column/key exists", which is
-- harmless - ensureSchema checks information_schema first and skips it.
ALTER TABLE `weekly_evaluations`
  DROP INDEX `weekly_evaluations_trainer_week`;

ALTER TABLE `weekly_evaluations`
  ADD UNIQUE INDEX `weekly_evaluations_trainer_batch_week` (`t_id`, `tb_id`, `we_week_key`);
