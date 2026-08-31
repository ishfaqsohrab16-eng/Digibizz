-- When a class actually starts, and at what times, per centre and course.
--
-- Its own table rather than columns on the course or the batch, because the
-- same course runs at several centres and does not start on the same day or at
-- the same hour in each. A morning class in Quetta and an evening one in Turbat
-- are the same course; anything hung off the course record would have to be one
-- answer for all of them and would be wrong for most.
--
-- It is also allowed to disagree with the batch record. The batch dates are a
-- plan; this is what the centre is telling the student, and the student turns up
-- on the strength of it.
--
-- Filled in BEFORE anyone is enrolled at that centre. The enrolment email quotes
-- these values, and telling an applicant to arrive on a blank date is worse than
-- sending nothing - so enrolment refuses to proceed without a row here and names
-- the class that is missing one.
--
-- sequelize.sync({ alter: false }) creates this on first boot, so a deployment
-- that never runs migration files by hand still converges. This file is the
-- record of intent and the thing to run where the application has no CREATE
-- rights.
--
-- Safe to re-run: IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS `class_schedules` (
  `cs_id`          INT NOT NULL AUTO_INCREMENT,
  `center_id`      INT NOT NULL,
  `course_id`      INT NOT NULL,
  -- Timings change between batches, so a schedule belongs to one. Without this,
  -- setting batch 10's start date would silently rewrite what batch 9's students
  -- were told.
  `tb_id`          INT NOT NULL,
  `cs_start_date`  DATE NOT NULL,
  -- Free text on purpose: "Monday to Friday", "Sat & Sun", "Mon/Wed/Fri".
  -- Centres describe their week in ways a fixed set of checkboxes would fight
  -- with, and these strings are only ever read by a person.
  `cs_class_days`  VARCHAR(120) NOT NULL,
  `cs_start_time`  VARCHAR(40) NOT NULL,
  `cs_end_time`    VARCHAR(40) NOT NULL,
  -- Anything else the student needs on day one - a room, a gate, a contact.
  `cs_note`        VARCHAR(500) NULL,
  `createdAt`      DATETIME NOT NULL,
  `updatedAt`      DATETIME NOT NULL,
  PRIMARY KEY (`cs_id`),
  -- One schedule per class. Two would mean two different answers to "when does
  -- it start", and the email would pick one at random.
  UNIQUE KEY `class_schedules_center_course_batch` (`center_id`, `course_id`, `tb_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
