-- Purpose:
--   Verify that no legacy latin1 tables remain after the utf8mb4 migration.
--
-- Run with:
--   mysql -h127.0.0.1 -P3306 -uroot -p lms_lmsdb < migration/003_verify_utf8mb4_schema.sql

SELECT
  TABLE_NAME,
  TABLE_COLLATION
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'lms_lmsdb'
  AND TABLE_COLLATION LIKE 'latin1%'
ORDER BY TABLE_NAME;
