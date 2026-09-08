const express = require("express");
const router = express.Router();
const controller = require("../controllers/centerVisitController");
const { uploadVisitMedia } = require("../middleware/uploadVisitMedia");
const { isAdminAuthenticated, requireRoles, ROLES } = require("../middleware/authMiddleware");

/**
 * The weekly centre visit.
 *
 * Master Trainers file them; Super Admins read them and mark them reviewed.
 * The guard is on the whole router rather than per route, so a route added
 * later is locked down by default rather than open by oversight.
 *
 * Read-only and content admins are included because seeing which centres went
 * unvisited is a monitoring question, not a privileged one. Writing is
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

// What is still owed this week, for the dashboard reminder.
router.get("/pending", controller.pending);

// Every centre needing a visit this week, and who has been.
router.get("/centers", controller.centers);

// The form for one centre.
router.get("/prepare", controller.prepare);

// Every centre for one week, visited or not. Admins only; the handler
// enforces that, and the unvisited rows are the point of it.
router.get("/overview", controller.overview);

// Save a draft, or submit. Multipart, because photographs and video come with
// it - `uploadVisitMedia` runs first so req.files is populated, and the
// handler deletes anything it then rejects rather than leaving orphans on disk.
router.post("/", uploadVisitMedia.array("media", 10), controller.save);

// Drop one photograph from a draft.
router.post("/:id/media/remove", controller.removeMedia);

// Mark a visit as read. Super Admins only; the handler enforces that.
router.post("/:id/review", controller.review);

// Kept last: "/pending" and the rest would otherwise be read as an id.
router.get("/:id", controller.show);

module.exports = router;
