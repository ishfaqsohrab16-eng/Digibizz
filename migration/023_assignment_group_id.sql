-- Ties together the copies of an assignment created for each of a trainer's
-- classes.
--
-- Setting one assignment writes one row per (centre, course) the trainer
-- teaches, because students are listed per class and submissions hang off a
-- single row. Until now those rows had nothing in common, so:
--
--   * editing the title changed it for ONE centre and left the others showing
--     the old one, and
--   * deleting removed one of three, leaving orphans the trainer could still
--     see but no longer recognised.
--
-- Nullable on purpose. Rows written before this column existed have no group
-- and are edited and deleted individually, exactly as they were - no backfill
-- is attempted, because guessing which historical rows were "the same
-- assignment" from a title and a date would join things that are not.
--
-- ensureSchema adds this column at startup too, so a deployment that never runs
-- migration files by hand still converges.
--
-- Safe to re-run: the ALTER errors with "Duplicate column name" if applied
-- twice, which is harmless.

ALTER TABLE `assignments`
  ADD COLUMN `as_group_id` VARCHAR(36) NULL AFTER `as_id`;

-- Every lookup by group is "give me the rest of this set".
CREATE INDEX `assignments_as_group_id` ON `assignments` (`as_group_id`);
