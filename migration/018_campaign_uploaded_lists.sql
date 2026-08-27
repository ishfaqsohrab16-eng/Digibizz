-- Campaigns can now send to an uploaded spreadsheet of addresses.
--
-- Two changes:
--   1. ec_audience gains 'list'.
--   2. Recipients can carry merge values that came from the file.
--
-- A list recipient has neither cand_id nor std_id: the address belongs to
-- nobody in the database. Both columns are already nullable (migration 017),
-- so no further relaxation is needed here.
--
-- ec_merge_data holds the spreadsheet's other columns as JSON, so a custom
-- template can use {{course}} or any other column the file supplied even
-- though there is no record behind the address to read it from.
--
-- ensureSchema adds ecr_merge_data at startup, but NOT the ENUM change - apply
-- this file for that. Re-running errors with "Duplicate column name", which is
-- harmless.

ALTER TABLE `email_campaigns`
  MODIFY COLUMN `ec_audience` ENUM('candidates','students','list')
    NOT NULL DEFAULT 'candidates'
    COMMENT 'candidates | students | list (uploaded spreadsheet)';

ALTER TABLE `email_campaign_recipients`
  ADD COLUMN `ecr_merge_data` TEXT NULL DEFAULT NULL
    COMMENT 'JSON of extra columns from an uploaded list, offered as merge tokens'
    AFTER `ecr_attempts`;
