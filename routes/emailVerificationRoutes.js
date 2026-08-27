const express = require("express");
const router = express.Router();
const controller = require("../controllers/emailVerificationController");

/**
 * Email confirmation for the public registration form.
 *
 * Deliberately unauthenticated: an applicant has no account yet, so there is
 * nothing to authenticate with. That also makes these the only endpoints in
 * the app that send mail on an anonymous request, which is why the controller
 * enforces a resend cooldown, a per-address hourly cap, and a limit on wrong
 * guesses. Do not add an endpoint here without the same limits.
 */
router.post("/send-code", controller.sendCode);
router.post("/verify-code", controller.verifyCode);
router.get("/status", controller.getStatus);

module.exports = router;
