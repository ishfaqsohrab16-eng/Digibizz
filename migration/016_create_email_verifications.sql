-- One-time codes confirming an applicant owns the email address they typed.
--
-- Applicants are told their interview date by email, so a typo means they
-- never hear from the program and the seat is wasted. The registration form
-- now sends a code to the address and will not submit until it is entered.
--
-- Safe to re-run: CREATE TABLE IF NOT EXISTS, no data written or altered.
-- sequelize.sync({ alter: false }) also creates this on first boot.
--
-- The code is stored HASHED. These endpoints are public and unauthenticated by
-- necessity - the applicant has no account yet - so anyone who could read this
-- table must not be able to complete somebody else's verification, and a
-- six-digit code kept in the clear would make that trivial.

CREATE TABLE IF NOT EXISTS `email_verifications` (
  `ev_id`           INT NOT NULL AUTO_INCREMENT,
  -- Always stored lower-cased, so casing cannot split one address into two
  -- rows and hand out two independent code budgets.
  `ev_email`        VARCHAR(150) NOT NULL,
  `ev_code_hash`    VARCHAR(128) NOT NULL,
  `ev_expires_at`   DATETIME NOT NULL,
  -- Wrong guesses against the current code; caps brute force.
  `ev_attempts`     INT NOT NULL DEFAULT 0,
  -- Codes issued in the current window; caps mail-bombing an address.
  `ev_sends`        INT NOT NULL DEFAULT 0,
  `ev_last_sent_at` DATETIME NULL DEFAULT NULL,
  -- Set once the address is proven. createCandidate refuses to save an
  -- application whose address has no verified row here.
  `ev_verified_at`  DATETIME NULL DEFAULT NULL,
  `ev_ip`           VARCHAR(45) NULL DEFAULT NULL,
  `createdAt`       DATETIME NOT NULL,
  `updatedAt`       DATETIME NOT NULL,
  PRIMARY KEY (`ev_id`),
  -- One live code per address: a new request replaces the old one rather than
  -- accumulating rows, so an applicant cannot hold several valid codes at once.
  UNIQUE KEY `email_verifications_email` (`ev_email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
