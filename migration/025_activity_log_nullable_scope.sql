-- Let the audit log record a change that has no course, centre or batch.
--
-- A change is tagged with the scope it belongs to, and most changes belong to
-- no scope at all: a document upload, a password change, a user editing their
-- own profile. The model has said allowNull: true for a long time, but
-- sequelize.sync({alter:false}) never reconciles a column that already exists,
-- so the deployed table still refuses NULL and every such change is dropped:
--
--   [audit] could not record updated on StudentsDocs: Column 'course_id'
--   cannot be null
--
-- The save itself succeeds - auditing is non-fatal by design - but the change
-- goes unrecorded, which is precisely what an audit log must not do quietly.
--
-- utils/ensureSchema.js applies this automatically on startup; this file is
-- here for a database that is updated by hand.
--
-- Relaxing only. No existing row is altered.

ALTER TABLE `activity_log`
  MODIFY COLUMN `course_id` INT NULL DEFAULT NULL
    COMMENT 'Course this change belongs to, when it belongs to one.',
  MODIFY COLUMN `center_id` INT NULL DEFAULT NULL
    COMMENT 'Centre this change belongs to, when it belongs to one.',
  MODIFY COLUMN `tb_id` INT NULL DEFAULT NULL
    COMMENT 'Batch this change belongs to, when it belongs to one.';
