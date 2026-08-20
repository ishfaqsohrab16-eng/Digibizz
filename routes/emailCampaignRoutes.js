const express = require("express");
const router = express.Router();
const controller = require("../controllers/emailCampaignController");
const {
  isAdminAuthenticated,
  requireRoles,
  ROLES,
} = require("../middleware/authMiddleware");

/**
 * Email campaigns are SuperAdmin-only.
 *
 * These endpoints send mail to hundreds of real applicants from the program's
 * own domain, so the guard is applied to the whole router rather than
 * per-route - a new endpoint added below is locked down by default instead of
 * being open until someone remembers to protect it.
 */
router.use(isAdminAuthenticated, requireRoles(ROLES.SUPER_ADMIN));

// How many candidates a new campaign could reach, broken down by course.
router.get("/eligibility", controller.getEligibility);
// Exactly who a campaign WOULD contact, before it is created.
// ?format=csv returns it as a download instead of JSON.
router.get("/recipients/preview", controller.previewRecipients);

router.get("/", controller.listCampaigns);
router.post("/", controller.createCampaign);
router.post("/preview", controller.previewTemplate);
// Starter HTML for the custom-email editor.
router.get("/starter-template", controller.getStarterTemplate);

router.get("/:id", controller.getCampaign);
router.get("/:id/recipients", controller.listRecipients);
router.get("/:id/recipients/export", controller.exportRecipients);
router.post("/:id/test", controller.sendTest);
router.post("/:id/reminder", controller.createReminder);
router.post("/:id/send-now", controller.sendNow);
// action: start | pause | cancel
router.post("/:id/status/:action", controller.updateStatus);

module.exports = router;
