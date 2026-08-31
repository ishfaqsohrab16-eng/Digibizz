-- Mail that could not be handed over yet, kept until it is.
--
-- Every send used to be a single attempt: if Brevo refused and SMTP was not
-- tried, the message was gone. Nobody found out until an applicant said they
-- never received their code, and by then there was nothing left to resend - the
-- content only ever existed as arguments on a stack.
--
-- A message that cannot be delivered immediately is now written here and
-- retried on a schedule, through whichever provider can carry it. A row leaves
-- this table in exactly two ways: sent, or declared dead after enough failures
-- - and dead rows raise an alert rather than going quiet.
--
-- sequelize.sync({ alter: false }) creates this on first boot, so a deployment
-- that never runs migration files by hand still converges. This file is the
-- record of intent and the thing to run where the application has no CREATE
-- rights.
--
-- Safe to re-run: IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS `email_outbox` (
  `eo_id`              INT NOT NULL AUTO_INCREMENT,
  `eo_to`              VARCHAR(320) NOT NULL,
  `eo_cc`              VARCHAR(320) NULL,
  `eo_bcc`             VARCHAR(320) NULL,
  `eo_reply_to`        VARCHAR(320) NULL,
  `eo_subject`         VARCHAR(500) NOT NULL,
  `eo_text`            LONGTEXT NULL,
  -- Campaign bodies are full HTML documents, so this needs the room.
  `eo_html`            LONGTEXT NULL,
  -- Transactional mail is somebody waiting at a form; campaign mail is not.
  -- Decides retry urgency and which SMTP transport carries it.
  `eo_priority`        TINYINT(1) NOT NULL DEFAULT 0,
  -- pending | sent | dead
  `eo_status`          VARCHAR(20) NOT NULL DEFAULT 'pending',
  `eo_attempts`        INT NOT NULL DEFAULT 0,
  -- Backoff. The drain only looks at rows that have come due.
  `eo_next_attempt_at` DATETIME NOT NULL,
  `eo_last_error`      VARCHAR(500) NULL,
  -- Which provider finally carried it, for answering "did this go out?".
  `eo_provider`        VARCHAR(20) NULL,
  `eo_message_id`      VARCHAR(255) NULL,
  `eo_sent_at`         DATETIME NULL,
  `createdAt`          DATETIME NOT NULL,
  `updatedAt`          DATETIME NOT NULL,
  PRIMARY KEY (`eo_id`),
  -- The drain's only query: pending rows that have come due, oldest first.
  KEY `email_outbox_due` (`eo_status`, `eo_next_attempt_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
