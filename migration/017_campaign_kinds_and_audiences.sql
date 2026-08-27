-- Makes the email module general rather than admissions-only.
--
-- Three changes:
--   1. ec_kind gains 'recommendation' and 'general'.
--   2. ec_audience says whether a campaign targets candidates or enrolled
--      students.
--   3. email_campaign_recipients can hold a student as well as a candidate.
--
-- Why (3) needs both columns rather than one generic id: candidates and
-- students live in different tables with different keys, so a single
-- "recipient_id" would lose which table it pointed at, and the foreign keys
-- that keep the data honest could not be declared at all. Exactly one of
-- cand_id / std_id is set per row.
--
-- ensureSchema adds the two new columns at startup, but NOT the ENUM changes,
-- the relaxed NOT NULL, or the new unique index - apply this file for those.
--
-- Re-running errors with "Duplicate column name" / "Duplicate key name", which
-- is harmless.

-- 1 + 2. Campaign kind and audience.
ALTER TABLE `email_campaigns`
  MODIFY COLUMN `ec_kind`
    ENUM('initial','reminder','recommendation','general')
    NOT NULL DEFAULT 'initial',
  ADD COLUMN `ec_audience` ENUM('candidates','students')
    NOT NULL DEFAULT 'candidates'
    COMMENT 'Who the campaign targets; recommendation letters always target students'
    AFTER `ec_kind`;

-- 3. Recipients may now be a student instead of a candidate.
--
-- cand_id must become nullable for that to be possible. Existing rows all have
-- one, so nothing is lost; the application requires exactly one of the two.
ALTER TABLE `email_campaign_recipients`
  MODIFY COLUMN `cand_id` INT NULL,
  ADD COLUMN `std_id` INT NULL DEFAULT NULL
    COMMENT 'Set instead of cand_id when the campaign targets enrolled students'
    AFTER `cand_id`;

ALTER TABLE `email_campaign_recipients`
  ADD CONSTRAINT `fk_ecr_student`
    FOREIGN KEY (`std_id`) REFERENCES `students` (`std_id`);

-- One row per student per campaign, mirroring the existing candidate rule.
-- MySQL permits repeated NULLs in a unique index, so a candidate-audience
-- campaign (every std_id NULL) does not collide with itself.
ALTER TABLE `email_campaign_recipients`
  ADD UNIQUE KEY `email_campaign_recipients_ec_id_std_id` (`ec_id`, `std_id`);

CREATE INDEX `email_campaign_recipients_std` ON `email_campaign_recipients` (`std_id`);
