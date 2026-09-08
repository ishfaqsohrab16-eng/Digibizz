-- The weekly centre visit.
--
-- A Master Trainer goes to every centre with a class running, fills in the
-- Visit Report Proforma, and attaches photographs or video. A Super Admin
-- reads it and marks it reviewed.
--
-- sequelize.sync({alter:false}) creates this table on first boot, so this file
-- is for a database that is updated by hand.
--
-- TWO THINGS WORTH KNOWING ABOUT THE SHAPE.
--
-- cv_center_id is NOT a foreign key. Zero means the Online Cell: the single
-- virtual centre standing for every online and hybrid centre, which nobody
-- travels to and which gets one form between them. A foreign key would make
-- that impossible to represent without inventing a row in `centers` that is
-- not a centre.
--
-- The unique key is (centre, batch, week) and deliberately does NOT include
-- mt_id. A centre is visited; it is not visited-by-each-of-us. Two reports
-- about the same room on the same day would be two answers to "was there
-- electricity", so whoever gets there first files it and the rest see it is
-- done. That is the rule for the Online Cell and for every physical centre
-- alike.

CREATE TABLE IF NOT EXISTS `center_visits` (
  `cv_id`             INT NOT NULL AUTO_INCREMENT,

  `mt_id`             INT NOT NULL COMMENT 'The Master Trainer who made the visit.',
  `cv_center_id`      INT NOT NULL COMMENT 'The centre visited. 0 is the Online Cell.',
  `cv_center_name`    VARCHAR(255) NOT NULL COMMENT 'Its name at the time, so an old report reads after a rename.',
  `tb_id`             INT NOT NULL COMMENT 'The batch whose classes were running there.',

  `cv_week_key`       VARCHAR(10) NOT NULL COMMENT 'The Friday the report week starts on.',
  `cv_week_start`     DATE NOT NULL,
  `cv_week_end`       DATE NOT NULL,

  -- When the visit actually happened, which is not the same as the week. The
  -- answers depend on it: "was there electricity" is about one afternoon.
  `cv_visit_date`     DATE NULL,
  `cv_visit_time`     VARCHAR(10) NULL,

  -- { trainer_on_time: { answer: "Yes", note: null }, ... }
  -- JSON rather than a column per question, because the proforma is a paper
  -- form that will gain a row the moment somebody thinks of one.
  `cv_answers`        JSON NOT NULL,
  `cv_remarks`        TEXT NULL COMMENT 'Overall remarks for the centre, at the foot of the form.',

  -- [{ file: "visit-172....jpg", type: "image", size: 402113 }]
  `cv_media`          JSON NULL COMMENT 'Photographs and video from the visit.',

  `cv_status`         VARCHAR(12) NOT NULL DEFAULT 'draft' COMMENT 'draft | submitted | reviewed',
  `cv_submitted_on`   DATETIME NULL,

  `cv_reviewed_by`      INT NULL,
  `cv_reviewed_by_name` VARCHAR(150) NULL COMMENT 'Their name at the time.',
  `cv_reviewed_on`      DATETIME NULL,
  `cv_review_note`      TEXT NULL,

  `cv_created_on`     DATETIME NOT NULL,
  `cv_updated_on`     DATETIME NOT NULL,

  PRIMARY KEY (`cv_id`),
  UNIQUE KEY `center_visits_center_batch_week` (`cv_center_id`, `tb_id`, `cv_week_key`),
  KEY `center_visits_mt_week` (`mt_id`, `cv_week_key`),
  KEY `center_visits_batch_week` (`tb_id`, `cv_week_key`, `cv_status`),

  CONSTRAINT `fk_center_visits_mt`
    FOREIGN KEY (`mt_id`) REFERENCES `mastertrainers` (`mt_id`),
  CONSTRAINT `fk_center_visits_batch`
    FOREIGN KEY (`tb_id`) REFERENCES `training_batches` (`tb_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
