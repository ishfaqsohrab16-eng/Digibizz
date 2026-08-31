/**
 * Feature switches.
 *
 * One definition per switch, read by every part of the app that cares, so a
 * feature is never half-off: the button hidden but the endpoints still live, or
 * the endpoints closed while a background job keeps working.
 *
 * Values come from the environment so a feature can be turned back on with a
 * restart rather than a deploy. The DEFAULT is what ships, and it is what runs
 * when nobody has set anything.
 */

/**
 * Read a boolean from the environment.
 *
 * Unset means "use the default". Anything else is compared explicitly, because
 * `Boolean("false")` is true - the mistake that silently enables a feature
 * somebody deliberately switched off.
 */
const envFlag = (name, fallback) => {
  const raw = process.env[name];
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return fallback;
  }
  const value = String(raw).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(value)) return true;
  if (["false", "0", "no", "off"].includes(value)) return false;

  console.warn(
    `[features] ${name}="${raw}" is not a boolean; using the default (${fallback}).`
  );
  return fallback;
};

/**
 * The bulk email campaign module.
 *
 * ON, now that Brevo carries the mail. It was switched off while campaigns
 * went through this deployment's own SMTP server, which could not be relied
 * on to deliver anything.
 *
 * While it is off:
 *   - the sidebar entry is hidden and the screen refuses to render,
 *   - every /api/email-campaigns endpoint answers 503,
 *   - the dispatcher does not start, so nothing queued goes out.
 *
 * Turn it back on with EMAIL_CAMPAIGNS_ENABLED=true in the environment. Nothing
 * is deleted while it is off - existing campaigns and their per-recipient
 * history stay in the database and resume where they stopped.
 *
 * Transactional mail (registration codes, password resets, notifications) is
 * NOT affected by this switch. It never was part of this module.
 */
const EMAIL_CAMPAIGNS_ENABLED = envFlag("EMAIL_CAMPAIGNS_ENABLED", true);

module.exports = { EMAIL_CAMPAIGNS_ENABLED, envFlag };
