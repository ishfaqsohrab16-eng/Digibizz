-- activity_log becomes the record of DATABASE CHANGES rather than of logins.
--
-- Login events now go to login_logs (migration 011) and are no longer written
-- here; a login row per session buried the edits people actually need to find.
-- Every insert, update and delete made by a signed-in user is recorded instead
-- by the global Sequelize hooks in utils/auditHooks.js - excluding students and
-- SuperAdmins, and excluding background work that has no person behind it.
--
-- Two parts:
--   1. New detail columns. utils/ensureSchema.js adds these at startup too.
--   2. Relaxing three NOT NULL foreign keys. This part is NOT handled by
--      ensureSchema, so it must be applied here.
--
-- Why (2) is necessary: course_id, center_id and tb_id were NOT NULL, which is
-- fine for a login row but impossible for a generic change. Editing a Course
-- or a Center has no batch, so the audit row could not be written at all - the
-- change would silently go unrecorded, which is the one thing an audit trail
-- must not do.
--
-- MySQL has no ADD COLUMN IF NOT EXISTS; re-running errors with "Duplicate
-- column name", which is harmless.

ALTER TABLE `activity_log`
  ADD COLUMN `act_actor_name` VARCHAR(150) NULL DEFAULT NULL
    COMMENT 'Name of whoever made the change',
  ADD COLUMN `act_entity` VARCHAR(100) NULL DEFAULT NULL
    COMMENT 'Model/table that changed',
  ADD COLUMN `act_entity_id` VARCHAR(100) NULL DEFAULT NULL
    COMMENT 'Primary key of the changed row',
  ADD COLUMN `act_summary` TEXT NULL DEFAULT NULL
    COMMENT 'Readable paragraph describing the change',
  ADD COLUMN `act_changes` LONGTEXT NULL DEFAULT NULL
    COMMENT 'JSON of field-level before/after values',
  ADD COLUMN `act_ip` VARCHAR(45) NULL DEFAULT NULL
    COMMENT 'IP the change came from';

-- A change to a Course, Center or Trainer has no batch/center/course scope.
ALTER TABLE `activity_log`
  MODIFY COLUMN `course_id` INT NULL,
  MODIFY COLUMN `center_id` INT NULL,
  MODIFY COLUMN `tb_id`     INT NULL;

-- Reading the trail is almost always "what happened to this record" or
-- "what did this person do", so index both.
CREATE INDEX `activity_log_entity` ON `activity_log` (`act_entity`, `act_entity_id`);
CREATE INDEX `activity_log_actor` ON `activity_log` (`user_id`, `act_on`);
