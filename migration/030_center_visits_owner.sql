-- Every Master Trainer visits every physical centre; the Online Cell is filed
-- once between them.
--
-- center_visits was first released with one report per centre per week across
-- everybody. That is right for the Online Cell - nobody travels to it and
-- there is nothing to see twice - and wrong for a physical centre, which every
-- Master Trainer visits and reports on separately. They go on different days
-- and see different things, and collapsing that into one report throws away
-- the disagreement, which is the most informative part of it.
--
-- cv_owner_id carries the difference so one unique index can express both
-- rules: the Master Trainer's id at a physical centre, 0 at the Online Cell.
-- "Unique on these columns, except when this other column says otherwise" is
-- not something a database can express, and enforcing it in the application
-- alone would race between two browser tabs.
--
-- utils/ensureSchema.js applies all of this automatically on startup, in this
-- order and before sync() runs; this file is for a database updated by hand.
--
-- DEFAULT 0 matches what a report filed under the old rule meant - one between
-- everybody - so nothing already stored changes meaning.

ALTER TABLE `center_visits`
  ADD COLUMN `cv_owner_id` INT NOT NULL DEFAULT 0
    COMMENT 'mt_id at a physical centre; 0 for the Online Cell.';

-- Every existing report was filed by somebody, and under the new rule a
-- physical-centre report belongs to its author. The Online Cell keeps 0.
UPDATE `center_visits` SET `cv_owner_id` = `mt_id` WHERE `cv_center_id` <> 0;

-- MySQL has no DROP INDEX IF EXISTS. On a database that never ran the first
-- version this errors harmlessly - ensureSchema checks information_schema
-- first and skips it.
ALTER TABLE `center_visits`
  DROP INDEX `center_visits_center_batch_week`;

ALTER TABLE `center_visits`
  ADD UNIQUE INDEX `center_visits_owner_center_batch_week`
    (`cv_owner_id`, `cv_center_id`, `tb_id`, `cv_week_key`);
