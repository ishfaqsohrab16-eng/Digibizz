const express = require("express");
const router = express.Router();
const controller = require("../controllers/weeklyEvaluationController");
const { isAdminAuthenticated, requireRoles, ROLES } = require("../middleware/authMiddleware");

/**
 * The weekly M&E report on trainer performance.
 *
 * Master Trainers write them; admins read them and see which are missing. The
 * guard is on the whole router rather than per route, so a route added later
 * is locked down by default rather than open by oversight.
 *
 * The trainer being evaluated is not on this list. That is deliberate: it is
 * an assessment written about them, and how it reaches them is a conversation
 * rather than a database read. Each handler narrows further - a Master Trainer
 * only ever sees the trainers who report to them.
 */
router.use(
  isAdminAuthenticated,
  requireRoles(
    ROLES.MASTER_TRAINER,
    ROLES.SUPER_ADMIN,
    ROLES.CONTENT_ADMIN,
    ROLES.READONLY_ADMIN
  )
);

// What a Master Trainer owes this week, for the dashboard reminder.
router.get("/pending", controller.pending);

// The trainers reporting to this Master Trainer, and where each report stands.
router.get("/my-trainers", controller.myTrainers);

// One trainer's form for one week, pre-filled from the LMS.
router.get("/prepare", controller.prepare);

// Every report written about one trainer.
router.get("/history", controller.history);

// Every trainer in the programme for one week, submitted or not. Admins only;
// the handler enforces that.
router.get("/overview", controller.overview);

// Save a draft, or submit. Master Trainers only; the handler enforces that.
router.post("/", controller.save);

// Mark a report as read. The M&E officer and Super Admins; the handler
// enforces that, and a read-only admin is deliberately not among them.
router.post("/:id/review", controller.review);

// Kept last: "/pending" and the rest would otherwise be read as an id.
router.get("/:id", controller.show);

module.exports = router;
