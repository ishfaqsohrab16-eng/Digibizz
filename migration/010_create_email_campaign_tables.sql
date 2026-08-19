-- Email campaign module: bulk interview call-ups to candidates, paced so the
-- sending domain does not get blocklisted.
--
-- Safe to re-run: both statements are CREATE TABLE IF NOT EXISTS and neither
-- writes or alters existing data.
--
-- `sequelize.sync({ alter: false })` in app.js also creates these tables on
-- first boot. This file exists so the schema can be applied deliberately
-- ahead of a deploy, and so the exact definition is reviewable.

CREATE TABLE IF NOT EXISTS `email_campaigns` (
  `ec_id`                 INT NOT NULL AUTO_INCREMENT,
  `ec_name`               VARCHAR(150) NOT NULL,
  `tb_id`                 INT NOT NULL,
  `center_id`             INT NOT NULL,
  -- initial = candidates never contacted for this center+batch.
  -- reminder = recipients of an earlier campaign who are still not interviewed.
  `ec_kind`               ENUM('initial','reminder') NOT NULL DEFAULT 'initial',
  `ec_source_campaign_id` INT NULL,
  `ec_target_count`       INT NOT NULL DEFAULT 0,
  -- Messages released per tick, and the nominal minutes between ticks.
  `ec_batch_size`         INT NOT NULL DEFAULT 25,
  `ec_interval_minutes`   INT NOT NULL DEFAULT 15,
  -- Random pause between two individual messages. A fixed cadence is itself a
  -- spam signal, so each gap is drawn from this range.
  `ec_min_gap_seconds`    INT NOT NULL DEFAULT 8,
  `ec_max_gap_seconds`    INT NOT NULL DEFAULT 30,
  `ec_subject`            VARCHAR(200) NOT NULL,
  `ec_interview_date`     VARCHAR(30) NULL,
  `ec_interview_time`     VARCHAR(50) NULL,
  `ec_venue`              VARCHAR(255) NULL,
  `ec_reporting_time`     VARCHAR(50) NULL,
  `ec_contact_person`     VARCHAR(150) NULL,
  `ec_contact_phone`      VARCHAR(50) NULL,
  `ec_message`            TEXT NULL,
  `ec_status`             ENUM('draft','running','paused','completed','cancelled')
                          NOT NULL DEFAULT 'draft',
  `ec_last_run_at`        DATETIME NULL,
  -- Next chunk due time, already jittered. Persisted so a restart cannot reset
  -- the schedule and fire a burst early.
  `ec_next_run_at`        DATETIME NULL,
  `ec_created_by`         INT NULL,
  `createdAt`             DATETIME NOT NULL,
  `updatedAt`             DATETIME NOT NULL,
  PRIMARY KEY (`ec_id`),
  KEY `email_campaigns_tb_id_center_id` (`tb_id`, `center_id`),
  KEY `email_campaigns_ec_status` (`ec_status`),
  CONSTRAINT `fk_email_campaigns_batch`
    FOREIGN KEY (`tb_id`) REFERENCES `training_batches` (`tb_id`),
  CONSTRAINT `fk_email_campaigns_center`
    FOREIGN KEY (`center_id`) REFERENCES `centers` (`center_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- One row per candidate per campaign: the frozen send list, and also the
-- ledger of who has already been contacted. A new `initial` campaign for a
-- center excludes every candidate appearing here for that center and batch,
-- which is what makes "now send the next 200" work without re-mailing anyone.
CREATE TABLE IF NOT EXISTS `email_campaign_recipients` (
  `ecr_id`       INT NOT NULL AUTO_INCREMENT,
  `ec_id`        INT NOT NULL,
  `cand_id`      INT NOT NULL,
  -- Snapshotted so a later edit to the candidate cannot silently redirect mail.
  `ecr_email`    VARCHAR(150) NOT NULL,
  `ecr_name`     VARCHAR(150) NULL,
  `course_id`    INT NULL,
  `ecr_status`   ENUM('pending','sent','failed','skipped') NOT NULL DEFAULT 'pending',
  `ecr_sent_at`  DATETIME NULL,
  `ecr_attempts` INT NOT NULL DEFAULT 0,
  `ecr_error`    VARCHAR(500) NULL,
  `createdAt`    DATETIME NOT NULL,
  `updatedAt`    DATETIME NOT NULL,
  PRIMARY KEY (`ecr_id`),
  -- Makes a retry or a double-clicked Create physically unable to queue the
  -- same person twice inside one campaign.
  UNIQUE KEY `email_campaign_recipients_ec_id_cand_id` (`ec_id`, `cand_id`),
  KEY `email_campaign_recipients_ec_id_status` (`ec_id`, `ecr_status`),
  KEY `email_campaign_recipients_cand_id` (`cand_id`),
  CONSTRAINT `fk_ecr_campaign`
    FOREIGN KEY (`ec_id`) REFERENCES `email_campaigns` (`ec_id`),
  CONSTRAINT `fk_ecr_candidate`
    FOREIGN KEY (`cand_id`) REFERENCES `candidates` (`cand_id`),
  CONSTRAINT `fk_ecr_course`
    FOREIGN KEY (`course_id`) REFERENCES `courses` (`course_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
