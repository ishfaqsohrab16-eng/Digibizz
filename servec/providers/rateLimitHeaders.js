/**
 * Reading the rate-limit headers both providers send.
 *
 * Shared because Groq and Cerebras spell the durations the same way and the
 * parsing is fiddly enough to get wrong twice. It was: one copy lost the
 * backslashes in its character classes, so every reset time read as zero, every
 * budget looked instantly stale, and the routing quietly stopped routing.
 *
 * The formats seen on the wire, all from the same accounts:
 *
 *   "5ms"      - the bucket is already full
 *   "30s"
 *   "1m30s"
 *   "23m2.4s"  - fractional seconds are normal
 *   "12"       - a bare number, from retry-after, meaning seconds
 */

/** Seconds, from any of the shapes above. Anything unrecognised is no wait. */
const parseDuration = (text) => {
  const value = String(text || "").trim();

  // Milliseconds first: "5ms" also matches the minutes-and-seconds pattern as
  // "5m" followed by nothing, which would read five milliseconds as five
  // minutes and sideline a model that was ready.
  const ms = value.match(/^(\d+(?:\.\d+)?)ms$/);
  if (ms) return Number(ms[1]) / 1000;

  const match = value.match(/^(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/);
  if (match && (match[1] || match[2])) {
    return Number(match[1] || 0) * 60 + Number(match[2] || 0);
  }

  const bare = Number(value);
  return Number.isFinite(bare) ? bare : 0;
};

module.exports = { parseDuration };
