const express = require("express");
const router = express.Router();
const controller = require("../controllers/aiAssistantController");
const {
  isAdminAuthenticated,
  requireRoles,
  ROLES,
} = require("../middleware/authMiddleware");

/**
 * The data assistant.
 *
 * Super Admin only, and the guard is on the whole router rather than per route
 * so a route added later is locked down by default.
 *
 * The restriction is not about the model - it is about the data. These
 * endpoints will answer questions across every centre, every batch and every
 * student, with no scoping by role, because that is what makes them useful.
 * There is no version of this that is safe to open to a trainer.
 */
router.use(isAdminAuthenticated, requireRoles(ROLES.SUPER_ADMIN));

// Whether Groq is reachable and the model is usable, so the panel can say
// what is wrong instead of failing when the first question is asked.
router.get("/status", controller.status);

router.post("/ask", controller.ask);

module.exports = router;
