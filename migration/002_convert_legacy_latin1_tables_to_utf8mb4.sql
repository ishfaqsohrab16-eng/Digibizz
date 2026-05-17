-- Purpose:
--   Convert legacy latin1 tables to utf8mb4 so assignment comments, feedback,
--   announcements, tickets, replies, and other text fields can store emojis
--   and extended Unicode characters.
--
-- Important:
--   1. Take a DB backup before running this migration.
--   2. Table conversion may lock tables while MySQL rewrites them.
--   3. This fixes future writes. Existing mojibake/corrupted text will not
--      automatically be repaired by charset conversion alone.
--   4. The schema contains some legacy zero datetime values. This script
--      temporarily relaxes the session sql_mode so MySQL 8 can rebuild those
--      tables during charset conversion.
--
-- Run with:
--   mysql -h127.0.0.1 -P3306 -uroot -p lms_lmsdb < migration/002_convert_legacy_latin1_tables_to_utf8mb4.sql

SET NAMES utf8mb4;
SET @OLD_SQL_MODE = @@SESSION.sql_mode;
SET SESSION sql_mode = '';

ALTER TABLE `activity_log` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `admins` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `assignment_submissions` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `assignments` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `attendance` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `candidates` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `centers` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `centers_dates` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `centerusers` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `class_announcements` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `courses` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `daily_lecture_reports` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `earnings` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `exam_assessment` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `holidays` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `learning_resources` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `lecture_recordings` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `mastertrainers` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `modules` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

ALTER TABLE `student_quiz_answers` DROP FOREIGN KEY `student_quiz_answers_ibfk_1`;
ALTER TABLE `student_quiz_answers` DROP FOREIGN KEY `student_quiz_answers_ibfk_2`;
ALTER TABLE `student_quiz_attempts` DROP FOREIGN KEY `student_quiz_attempts_ibfk_1`;
ALTER TABLE `student_quiz_attempts` DROP FOREIGN KEY `student_quiz_attempts_ibfk_2`;
ALTER TABLE `student_quiz_questions` DROP FOREIGN KEY `student_quiz_questions_ibfk_1`;

ALTER TABLE `student_quiz_answers`
  MODIFY `quiz_code` varchar(100) NOT NULL;

ALTER TABLE `student_quiz_attempts`
  MODIFY `quiz_code` varchar(100) NOT NULL,
  MODIFY `std_cnic` varchar(50) NOT NULL;

ALTER TABLE `student_quiz` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `student_quiz_answers` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `student_quiz_attempts` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `student_quiz_questions` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

ALTER TABLE `student_quiz_questions`
  ADD CONSTRAINT `student_quiz_questions_ibfk_1`
  FOREIGN KEY (`quiz_code`) REFERENCES `student_quiz` (`quiz_code`) ON UPDATE CASCADE;

ALTER TABLE `student_quiz_attempts`
  ADD CONSTRAINT `student_quiz_attempts_ibfk_1`
  FOREIGN KEY (`quiz_code`) REFERENCES `student_quiz` (`quiz_code`) ON UPDATE CASCADE;

ALTER TABLE `student_quiz_answers`
  ADD CONSTRAINT `student_quiz_answers_ibfk_1`
  FOREIGN KEY (`quiz_code`) REFERENCES `student_quiz` (`quiz_code`) ON UPDATE CASCADE,
  ADD CONSTRAINT `student_quiz_answers_ibfk_2`
  FOREIGN KEY (`attempt_session`) REFERENCES `student_quiz_attempts` (`attempt_session`) ON UPDATE CASCADE;

ALTER TABLE `students` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `students_docs` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

ALTER TABLE `student_quiz_attempts`
  ADD CONSTRAINT `student_quiz_attempts_ibfk_2`
  FOREIGN KEY (`std_cnic`) REFERENCES `students` (`std_cnic`) ON UPDATE CASCADE;

ALTER TABLE `students_feedback` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `students_freelancing_profiles` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `students_leaves` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `ticket_replies` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `tickets` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `topics` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `trainer_attendance` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `trainer_leaves` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `trainer_topic_reports` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `trainers` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `trainers_center_allocation` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `training_batches` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `user` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

SET SESSION sql_mode = @OLD_SQL_MODE;
