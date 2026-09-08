-- Attendance, the review stage, and the wider feedback column.
--
-- Three changes to weekly_evaluations, all additive:
--
--   we_attendance   Present, absent and on leave for each of the five teaching
--                   days, counted from the register. Stored on the report
--                   rather than joined at read time because attendance can be
--                   corrected afterwards and a signed report has to keep
--                   saying what it said.
--
--   the review stage  The second signature on the paper form. A Super Admin or
--                   the M&E officer marks a report as read, and the Master
--                   Trainer can see that they have. we_status gains a third
--                   value, "reviewed".
--
--   we_feedback_submission widens from 10 to 20 characters. Trainees' feedback
--                   was Yes/No, which recorded whether the exercise happened
--                   rather than what it said; it is now the same four-point
--                   scale as the quality grade, and "Satisfactory" is 12
--                   characters.
--
-- utils/ensureSchema.js adds the columns automatically on startup and widens
-- the feedback column; this file is for a database updated by hand.
--
-- Any Yes/No already stored stays as it is. It is not on the new scale and
-- will read as an unrecognised grade, which is correct - it is what somebody
-- actually answered, and rewriting it to "Good" would be inventing an
-- assessment nobody made.

ALTER TABLE `weekly_evaluations`
  ADD COLUMN `we_attendance` JSON NULL
    COMMENT 'Present, absent and on leave per teaching day, from the register.',
  ADD COLUMN `we_reviewed_by` INT NULL
    COMMENT 'The user who marked it reviewed.',
  ADD COLUMN `we_reviewed_by_name` VARCHAR(150) NULL
    COMMENT 'Their name at the time, so an old report still reads.',
  ADD COLUMN `we_reviewed_on` DATETIME NULL,
  ADD COLUMN `we_review_note` TEXT NULL
    COMMENT 'Optional note from the reviewer, shown to the Master Trainer.';

ALTER TABLE `weekly_evaluations`
  MODIFY COLUMN `we_feedback_submission` VARCHAR(20) NULL
    COMMENT 'Trainees'' Feedback: Excellent | Good | Satisfactory | Poor';
