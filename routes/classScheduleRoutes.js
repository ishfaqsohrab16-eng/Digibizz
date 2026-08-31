const express = require("express");
const router = express.Router();
const controller = require("../controllers/classScheduleController");
const {
  isAdminAuthenticated,
  requireRoles,
  ADMIN_ROLES,
} = require("../middleware/authMiddleware");

/**
 * Class start dates and timings.
 *
 * Same guard as enrolment. These values are quoted verbatim in the email an
 * applicant receives and travel to a centre on, so changing them is not a
 * lesser act than enrolling somebody - a wrong start date here sends a room
 * full of people on the wrong day.
 */
router.use(isAdminAuthenticated, requireRoles(ADMIN_ROLES));

// Every class in the batch, with its schedule or a visible hole where one
// should be. The hole is the reason to open this screen.
router.get("/:tb_id", controller.listSchedules);

// Upsert. The screen edits a grid where some classes have a row and some do
// not; making the browser track which is which is how you get a duplicate.
router.post("/", controller.saveSchedule);

router.delete("/:cs_id", controller.deleteSchedule);

module.exports = router;
