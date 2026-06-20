-- Allow students to submit longer written feedback without hitting
-- "Data too long" errors from VARCHAR(255) columns.

ALTER TABLE `students_feedback`
  MODIFY `sf_trainer_feedback` LONGTEXT NULL,
  MODIFY `sf_lab_feedback` LONGTEXT NULL;
