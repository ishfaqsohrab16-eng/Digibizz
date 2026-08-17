-- Adds the interviewer-verified "University of Balochistan student" flag.
--
-- This is deliberately independent of the `institute` column. `institute` is
-- what the applicant selected on the registration form; this column is what
-- the interviewer confirmed by asking during the interview. They can disagree,
-- and the interviewer's answer is the one staff should act on.
--
-- NULL  = not asked yet (no interview, or interviewer skipped it)
-- 0     = interviewer confirmed NOT a University of Balochistan student
-- 1     = interviewer confirmed IS a University of Balochistan student
--
-- Nullable with no default, so existing rows are untouched and "never asked"
-- stays distinguishable from an explicit "No".
--
-- Safe to re-run: the SELECT guard makes this a no-op if the column exists.

SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'candidates'
    AND COLUMN_NAME = 'is_uob_student'
);

SET @ddl := IF(
  @column_exists = 0,
  'ALTER TABLE `candidates` ADD COLUMN `is_uob_student` TINYINT(1) NULL DEFAULT NULL COMMENT ''Interviewer-verified University of Balochistan student: NULL=not asked, 0=no, 1=yes''',
  'SELECT ''Column candidates.is_uob_student already exists - nothing to do'' AS notice'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
