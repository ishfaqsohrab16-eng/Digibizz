-- Widen daily_lecture_reports.dlr_challenges from VARCHAR(255) to TEXT.
--
-- This column holds a trainer's free-text account of what went wrong in a
-- lecture. 255 characters is about three sentences. A trainer describing a
-- room with the fans switched off so students could hear, and students
-- leaving early to catch their buses, wrote 340 - and the entire daily report
-- was rejected:
--
--   ER_DATA_TOO_LONG (1406): Data too long for column 'dlr_challenges' at row 1
--
-- The report is the only record of that lecture, so losing it to a field
-- width is the worst possible outcome. dlr_topics beside it is already TEXT.
--
-- utils/ensureSchema.js applies this automatically on startup; this file is
-- here for a database that is updated by hand.
--
-- Widening only. No existing value can be truncated by running it.

ALTER TABLE `daily_lecture_reports`
  MODIFY COLUMN `dlr_challenges` TEXT NOT NULL;
