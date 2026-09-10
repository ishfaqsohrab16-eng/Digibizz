-- One row per class per trainer, enforced by the database.
--
-- trainers_center_allocation records which (centre, course) pairs a trainer
-- teaches in a batch. Nothing stopped the same pair being recorded twice, and
-- a duplicate row breaks every feature that fans out over allocations: setting
-- one assignment wrote two identical ones, which then deleted together because
-- they share an as_group_id. Announcements and daily lecture reports hit the
-- same thing before that.
--
-- The application no longer writes doubles - utils/trainerScope.js collapses
-- allocations to distinct classes first - but that is a rule held in code, and
-- the next feature to read this table has to remember it. This makes the
-- database hold it instead.
--
-- APPLY THE CLEANUP FIRST. This statement fails while duplicates exist, and it
-- has to: the whole point is that the combination is unique. Run
--
--   node scripts/clean-duplicate-allocations.js --apply
--
-- which keeps the lowest tca_id of each set, then run this. It is NOT applied
-- automatically at startup for that reason - an index that cannot be built
-- would otherwise be retried, and logged, on every single boot.

ALTER TABLE `trainers_center_allocation`
  ADD UNIQUE INDEX `tca_trainer_batch_center_course`
    (`t_id`, `tb_id`, `center_id`, `course_id`);
