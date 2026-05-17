-- Purpose:
--   Ensure the LMS database default charset/collation is emoji-safe for all
--   newly created tables and columns.
--
-- Run with:
--   mysql -h127.0.0.1 -P3306 -uroot -p lms_lmsdb < migration/001_set_database_default_to_utf8mb4.sql

ALTER DATABASE `lms_lmsdb`
  CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;
