-- Tables for sending through Brevo.
--
-- Two pieces of bookkeeping, both small and both self-clearing:
--
--   email_send_quota  - how much of the day's allowance has been used. Brevo's
--                       free plan is 300 emails a day across everything, so
--                       campaigns and registration codes come out of one pot.
--                       Without a count, a few hundred campaign addresses would
--                       spend the whole day's allowance in one run and every
--                       applicant afterwards would be told "we could not send
--                       the code", with nothing able to explain why. One row
--                       per day; it survives restarts, which an in-memory
--                       counter would not.
--
--   brevo_contacts    - addresses mailed through Brevo, kept only until their
--                       contact has been deleted from the Brevo account 24
--                       hours later. Rows are removed as they are dealt with:
--                       the table is itself a list of email addresses, so
--                       keeping them would rebuild the very thing the cleanup
--                       exists to prevent. It holds at most a day of sending.
--
-- sequelize.sync({ alter: false }) creates both tables on first boot, so a
-- deployment that never runs migration files by hand still converges. This file
-- is the record of intent and the thing to run where the application has no
-- CREATE rights.
--
-- Safe to re-run: both statements are IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS `email_send_quota` (
  `esq_id`            INT NOT NULL AUTO_INCREMENT,
  -- YYYY-MM-DD in the program's own timezone, not UTC: "today's limit" has to
  -- mean the day the people running this are living in.
  `esq_date`          VARCHAR(10) NOT NULL,
  `esq_total`         INT NOT NULL DEFAULT 0,
  -- Registration codes, password resets - mail somebody is waiting on.
  `esq_transactional` INT NOT NULL DEFAULT 0,
  -- Campaign and announcement mail.
  `esq_campaign`      INT NOT NULL DEFAULT 0,
  `createdAt`         DATETIME NOT NULL,
  `updatedAt`         DATETIME NOT NULL,
  PRIMARY KEY (`esq_id`),
  UNIQUE KEY `email_send_quota_esq_date` (`esq_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `brevo_contacts` (
  `bc_id`           INT NOT NULL AUTO_INCREMENT,
  `bc_email`        VARCHAR(150) NOT NULL,
  -- 24 hours after the LAST message to this address, not the first: deleting a
  -- contact mid-conversation only means deleting it again tomorrow.
  `bc_delete_after` DATETIME NOT NULL,
  `bc_attempts`     INT NOT NULL DEFAULT 0,
  `bc_last_error`   VARCHAR(255) NULL,
  `createdAt`       DATETIME NOT NULL,
  `updatedAt`       DATETIME NOT NULL,
  PRIMARY KEY (`bc_id`),
  UNIQUE KEY `brevo_contacts_bc_email` (`bc_email`),
  -- The sweep asks for "everything due" every half hour, forever.
  KEY `brevo_contacts_bc_delete_after` (`bc_delete_after`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
