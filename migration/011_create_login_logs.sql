-- Staff login audit trail: who signed in, when, from which IP and client.
--
-- Students are deliberately not recorded here. They are the bulk of the user
-- base and their logins already land in activity_logs, so including them would
-- bury the staff trail this table exists to provide.
--
-- Safe to re-run: CREATE TABLE IF NOT EXISTS, no data written or altered.
-- `sequelize.sync({ alter: false })` in app.js also creates this table on first
-- boot; this file exists so it can be applied deliberately ahead of a deploy
-- and so the definition is reviewable.
--
-- Note there is no foreign key on user_id. The log has to survive the user
-- record being deleted - an audit trail that disappears when the account does
-- is not an audit trail. The snapshotted name/username/type columns are what
-- keep such a row readable afterwards.

CREATE TABLE IF NOT EXISTS `login_logs` (
  `ll_id`              INT NOT NULL AUTO_INCREMENT,
  `user_id`            INT NOT NULL,
  -- Snapshotted, not joined: the log must say who signed in AT THAT MOMENT.
  -- A later rename or role change must not rewrite history.
  `ll_user_name`       VARCHAR(150) NULL,
  `ll_user_username`   VARCHAR(150) NULL,
  `ll_user_type`       VARCHAR(50) NULL,
  -- 45 chars so a full IPv6 address fits.
  `ll_ip`              VARCHAR(45) NULL,
  -- The untrimmed X-Forwarded-For chain. The header is client-settable, so
  -- keeping the raw chain next to the resolved IP is what makes a forged
  -- value detectable after the fact rather than merely wrong.
  `ll_forwarded_for`   VARCHAR(255) NULL,
  `ll_user_agent`      VARCHAR(512) NULL,
  -- 'password' for a normal sign-in, 'impersonation' when an admin used
  -- "Login as user".
  `ll_method`          VARCHAR(30) NOT NULL DEFAULT 'password',
  `ll_impersonated_by` INT NULL,
  `ll_center_id`       INT NULL,
  `ll_course_id`       INT NULL,
  `ll_tb_id`           INT NULL,
  `ll_login_at`        DATETIME NOT NULL,
  `createdAt`          DATETIME NOT NULL,
  `updatedAt`          DATETIME NOT NULL,
  PRIMARY KEY (`ll_id`),
  KEY `login_logs_user_id` (`user_id`),
  KEY `login_logs_login_at` (`ll_login_at`),
  KEY `login_logs_user_type` (`ll_user_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
