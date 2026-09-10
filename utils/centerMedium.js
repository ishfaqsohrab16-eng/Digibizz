/**
 * Is a centre taught online?
 *
 * Online AND Hybrid. A hybrid centre's online cohort is taught the same way as
 * a fully online one, so both are reported on the Online Classes Report, and
 * both are left out of the per-trainer M&E report, which is for classes a
 * Master Trainer can walk into.
 *
 * Anything else - "Physical", a blank, a value nobody expected - is physical.
 * center_medium defaults to Physical, and a centre that was never classified
 * is far more likely to be a building than a video call.
 */
const ONLINE_MEDIA = new Set(["online", "hybrid"]);

const isOnlineMedium = (medium) =>
  ONLINE_MEDIA.has(String(medium ?? "").trim().toLowerCase());

module.exports = { isOnlineMedium };
