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
 * OFF for now, at the program's request. The sidebar entry is hidden and the
 * screen refuses to render.
 *
 * To bring it back, set this to true AND set EMAIL_CAMPAIGNS_ENABLED=true in
 * the server environment. Turning on only one of the two gives either a visible
 * screen whose every request fails with 503, or live endpoints nothing calls.
 *
 * Registration codes, password resets and notification email are unaffected:
 * that is transactional mail and was never part of this module.
 */
export const EMAIL_CAMPAIGNS_ENABLED = false;
