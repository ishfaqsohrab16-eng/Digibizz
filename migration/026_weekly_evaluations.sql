-- The weekly M&E report on trainer performance.
--
-- One report per trainer per week, written by their Master Trainer. The paper
-- form is "DigiBizz Program Weekly M&E Report - Trainers Performance", signed
-- by the M&E Officer and the Master Trainer.
--
-- sequelize.sync({alter:false}) creates this table on first boot, so this file
-- is for a database that is updated by hand.
--
-- NOTE ON THE UNIQUE INDEX. A trainer teaching three classes in a batch gets
-- ONE report covering all three, not three near-identical forms. The batch is
-- part of the key because the module is read a batch at a time and a trainer
-- running classes in two batches is doing two separable jobs.
-- (t_id, tb_id, we_week_key)
-- makes a second report for the same week impossible in the database rather
-- than merely checked for in the application, which is what makes it safe when
-- two browser tabs submit at once.

CREATE TABLE IF NOT EXISTS `weekly_evaluations` (
  `we_id`            INT NOT NULL AUTO_INCREMENT,

  `t_id`             INT NOT NULL COMMENT 'The trainer being evaluated.',
  `mt_id`            INT NOT NULL COMMENT 'The Master Trainer who filled it in.',
  `tb_id`            INT NOT NULL COMMENT 'The batch this report covers.',

  `we_week_key`      VARCHAR(10) NOT NULL COMMENT 'ISO week, e.g. 2026-W37.',
  `we_week_start`    DATE NOT NULL COMMENT 'Monday. The From Date on the form.',
  `we_week_end`      DATE NOT NULL COMMENT 'Friday. The To Date on the form.',

  -- Four criteria across five teaching days. JSON rather than twenty columns:
  -- the paper form has a blank fifth row for a criterion added by hand, and
  -- twenty columns could not carry one without another migration.
  `we_daily`         JSON NOT NULL,
  `we_custom_label`  VARCHAR(120) NULL COMMENT 'The blank row, when it is used.',

  `we_assignments`     INT NULL,
  `we_quizzes`         INT NULL,
  `we_quality`         VARCHAR(20) NULL COMMENT 'Excellent | Good | Satisfactory | Poor',
  `we_mt_visit_date`   DATE NULL,
  `we_enrolled_start`  INT NULL,
  `we_dropouts`        INT NULL,
  `we_new_enrolled`    INT NULL,
  `we_on_leave`        INT NULL,
  `we_feedback_submission` VARCHAR(10) NULL COMMENT 'Yes | No',

  `we_other_tasks`   TEXT NULL,
  `we_remarks`       TEXT NULL,

  -- Snapshots, deliberately. The classes a trainer taught and the figures the
  -- LMS computed are both recorded as they stood when the report was written,
  -- because an allocation can be changed and a student can be removed
  -- afterwards - and a signed report has to keep saying what it said.
  `we_classes`       JSON NULL,
  `we_auto`          JSON NULL,

  `we_status`        VARCHAR(12) NOT NULL DEFAULT 'draft' COMMENT 'draft | submitted',
  `we_submitted_on`  DATETIME NULL,

  `we_created_on`    DATETIME NOT NULL,
  `we_updated_on`    DATETIME NOT NULL,

  PRIMARY KEY (`we_id`),
  UNIQUE KEY `weekly_evaluations_trainer_batch_week` (`t_id`, `tb_id`, `we_week_key`),
  KEY `weekly_evaluations_mt_week` (`mt_id`, `we_week_key`),
  KEY `weekly_evaluations_batch_week` (`tb_id`, `we_week_key`, `we_status`),

  CONSTRAINT `fk_weekly_evaluations_trainer`
    FOREIGN KEY (`t_id`) REFERENCES `trainers` (`t_id`),
  CONSTRAINT `fk_weekly_evaluations_mt`
    FOREIGN KEY (`mt_id`) REFERENCES `mastertrainers` (`mt_id`),
  CONSTRAINT `fk_weekly_evaluations_batch`
    FOREIGN KEY (`tb_id`) REFERENCES `training_batches` (`tb_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
