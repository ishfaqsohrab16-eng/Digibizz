const express = require("express");
const router = express.Router();
const controller = require("../controllers/onlineClassReportController");
const { isAdminAuthenticated, requireRoles, ROLES } = require("../middleware/authMiddleware");

/**
 * The weekly Online Classes Report - the M&E report for online and hybrid
 * centres, one per centre per week.
 *
 * Same audiences as the rest of the M&E module: Master Trainers file it,
 * admins read it, a Super Admin marks it reviewed. The guard is on the whole
 * router so a route added later is locked down by default, and writing is
 * narrowed further inside each handler.
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

// Every online and hybrid centre for a week, and where its report stands.
router.get("/", controller.list);

// The form for one centre and one week.
router.get("/prepare", controller.prepare);

// Save as a draft, or submit.
router.post("/", controller.save);

// Mark as reviewed, or withdraw that.
router.post("/:id/review", controller.review);

// One report, in full. Last, so it cannot swallow the named routes above.
router.get("/:id", controller.show);

module.exports = router;
