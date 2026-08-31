/**
 * Feature switches for the UI.
 *
 * Mirrors config/features.js on the server. Both must agree: the server closes
 * the endpoints, and this only decides whether the screen is offered. The
 * server is the half that matters - a hidden button stops nobody who already
 * has the URL.
 */

/**
 * The bulk email campaign module.
 *
 * ON, now that Brevo carries the mail. It was switched off while campaigns
 * went through the deployment's own SMTP server, which could not be relied on
 * to deliver anything.
 *
 * Setting this to false hides the sidebar entry and makes the screen refuse to
 * render. Do it together with EMAIL_CAMPAIGNS_ENABLED=false on the server:
 * changing only one gives either a visible screen whose every request fails
 * with 503, or live endpoints nothing calls.
 *
 * Registration codes, password resets and notification email are unaffected:
 * that is transactional mail and was never part of this module.
 */
export const EMAIL_CAMPAIGNS_ENABLED = true;
