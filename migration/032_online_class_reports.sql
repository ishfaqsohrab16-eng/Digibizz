-- The weekly Online Classes Report: one online or hybrid centre, one week.
--
-- Physical centres are reported per trainer in weekly_evaluations. Online and
-- hybrid centres are reported per CENTRE here, from the paper "Online Classes
-- Report": four written answers, the register's daily counts per course, and
-- remarks.
--
-- The unique key is the rule itself: one report per centre per batch per week,
-- between every Master Trainer. Whoever starts it has it.
--
-- sequelize.sync() creates this table on first boot, because it is new; this
-- file is for a database managed by hand.

CREATE TABLE IF NOT EXISTS `online_class_reports` (
  `ocr_id` INT NOT NULL AUTO_INCREMENT,
  `mt_id` INT NOT NULL COMMENT 'The Master Trainer who filed it.',
  `ocr_center_id` INT NOT NULL,
  `ocr_center_name` VARCHAR(255) NOT NULL,
  `ocr_medium` VARCHAR(20) NULL,
  `tb_id` INT NOT NULL,
  `ocr_week_key` VARCHAR(10) NOT NULL,
  `ocr_week_start` DATE NOT NULL,
  `ocr_week_end` DATE NOT NULL,
  `ocr_answers` JSON NOT NULL,
  `ocr_attendance` JSON NULL,
  `ocr_remarks` TEXT NULL,
  `ocr_status` VARCHAR(12) NOT NULL DEFAULT 'draft',
  `ocr_submitted_on` DATETIME NULL,
  `ocr_reviewed_by` INT NULL,
  `ocr_reviewed_by_name` VARCHAR(150) NULL,
  `ocr_reviewed_on` DATETIME NULL,
  `ocr_review_note` TEXT NULL,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`ocr_id`),
  UNIQUE KEY `online_class_reports_center_batch_week` (`ocr_center_id`, `tb_id`, `ocr_week_key`),
  KEY `online_class_reports_mt_week` (`mt_id`, `ocr_week_key`),
  KEY `online_class_reports_batch_week` (`tb_id`, `ocr_week_key`, `ocr_status`)
);
