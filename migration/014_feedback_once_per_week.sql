-- Feedback becomes once per week, on any day of that week (previously the UI
-- allowed it only on Fridays, and the API allowed it without limit).
--
-- sf_week holds an ISO week key such as '2026-W34'. Storing the week makes the
-- rule enforceable by a unique index rather than by a check-then-insert, which
-- two quick clicks can race past.
--
-- Existing rows keep a NULL sf_week. MySQL permits repeated NULLs in a unique
-- index, so history is untouched and no back-fill is required.
--
-- utils/ensureSchema.js adds the column at startup if it is missing, but NOT
-- the index - so apply this file to get the guarantee, not just the column.
--
-- MySQL has no ADD COLUMN IF NOT EXISTS; re-running errors with "Duplicate
-- column name" / "Duplicate key name". Both are harmless.

ALTER TABLE `students_feedback`
  ADD COLUMN `sf_week` VARCHAR(10) NULL DEFAULT NULL
    COMMENT 'ISO week key (2026-W34); one feedback per student per batch per week'
    AFTER `sf_month`;

-- The actual guarantee. If this fails with "Duplicate entry", the table already
-- contains more than one row for some student in the same week; resolve those
-- rows first, then re-run:
--
--   SELECT std_rollno, tb_id, sf_week, COUNT(*) c
--     FROM students_feedback
--    WHERE sf_week IS NOT NULL
--    GROUP BY std_rollno, tb_id, sf_week
--   HAVING c > 1;
ALTER TABLE `students_feedback`
  ADD UNIQUE KEY `students_feedback_once_per_week` (`std_rollno`, `tb_id`, `sf_week`);
