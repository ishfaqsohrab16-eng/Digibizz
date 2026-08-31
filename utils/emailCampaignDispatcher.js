const { Op } = require("sequelize");
const EmailCampaign = require("../models/emailCampaignModel");
const EmailCampaignRecipient = require("../models/emailCampaignRecipientModel");
const {
  sendEmail,
  isConfigured,
  provider,
  canFallBackToSmtp,
} = require("../servec/emailConfig");
const { EMAIL_CAMPAIGNS_ENABLED } = require("../config/features");
const quota = require("./emailQuota");
// Candidate, Student, Course, Center, TrainingBatch and the campaign template
// renderers are deliberately NOT imported any more. A campaign no longer
// resolves people out of the database or picks a built-in letter: it sends one
// static, operator-written body to a list of addresses.

/**
 * Paces campaign email out over time.
 *
 * Three constraints shape this:
 *
 * 1. Volume. A few hundred messages leaving one IP inside a minute is the
 *    classic blocklist trigger, so only `ec_batch_size` go out per tick and
 *    ticks are `ec_interval_minutes` apart.
 * 2. Regularity. A perfectly even cadence is itself a spam signal, so the gap
 *    between individual messages is randomised within
 *    [ec_min_gap_seconds, ec_max_gap_seconds] and the gap between chunks gets
 *    +/-25% jitter. Neither rhythm is predictable.
 * 3. Concurrency. Several campaigns run at once - different centers are
 *    contacted on different days - so each drains on its own schedule rather
 *    than queueing behind whichever started first. A chunk can take many
 *    minutes to drain, so serialising them would let one campaign starve the
 *    rest.
 *
 * Parallelism is per campaign and capped by MAX_CONCURRENT_CAMPAIGNS. The
 * actual socket pressure is bounded independently by the nodemailer pool in
 * servec/emailConfig.js (maxConnections/rateLimit), so running several
 * campaigns at once does not multiply the load on the mail server.
 *
 * All progress lives in the database (`ecr_status`, `ec_next_run_at`), so a
 * restart mid-campaign resumes exactly where it stopped and never re-sends a
 * message that was already accepted by the SMTP server.
 */

/** How often to look for campaigns that have become due. */
const POLL_INTERVAL_MS = 60 * 1000;

/** Chunk-to-chunk jitter, as a fraction of the configured interval. */
const INTERVAL_JITTER = 0.25;

/** Give up on a recipient after this many failed attempts. */
const MAX_ATTEMPTS = 3;

/**
 * Upper bound on campaigns draining at the same moment. Generous enough that
 * normal operation never queues, low enough that a mistake cannot open an
 * unbounded number of concurrent send loops.
 */
const MAX_CONCURRENT_CAMPAIGNS = 5;

/**
 * Addresses that receive a dummy copy of every campaign before it goes out.
 *
 * A rendered proof in a real inbox catches what a preview pane cannot: a
 * broken layout in Outlook, a subject line truncated on mobile, or the whole
 * message landing in spam. Comma-separate CAMPAIGN_TEST_RECIPIENTS in the
 * environment to change the list without a deploy.
 */
const TEST_RECIPIENTS = (
  process.env.CAMPAIGN_TEST_RECIPIENTS ||
  "ishfaque.bcs18@iba-suk.edu.pk,ishfaqsohrab.16@gmail.com"
)
  .split(",")
  .map((address) => address.trim())
  .filter(Boolean);

let timer = null;

/**
 * Campaign ids currently draining a chunk.
 *
 * This replaces a single global "busy" flag: that would have made a slow
 * campaign block every other one, which is exactly the serialisation this
 * module needs to avoid. Membership here is what keeps one campaign from
 * being started twice concurrently.
 */
const inFlight = new Set();

/**
 * Take exclusive ownership of a campaign's send loop.
 *
 * Returns false when it is already draining. Both the scheduler and the
 * manual "send now" button go through this: without it the two could select
 * the same pending recipients at the same moment and email them twice.
 */
const claim = (ecId) => {
  const id = Number(ecId);
  if (inFlight.has(id)) return false;
  inFlight.add(id);
  return true;
};

const release = (ecId) => inFlight.delete(Number(ecId));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const randomInt = (min, max) =>
  Math.floor(Math.random() * (Math.max(min, max) - Math.min(min, max) + 1)) +
  Math.min(min, max);

/** Next due time for a campaign, with jitter so chunks never land on a rhythm. */
const computeNextRunAt = (campaign, from = new Date()) => {
  const baseMs = Math.max(1, Number(campaign.ec_interval_minutes) || 15) * 60000;
  const spread = baseMs * INTERVAL_JITTER;
  const jittered = baseMs + (Math.random() * 2 - 1) * spread;
  return new Date(from.getTime() + Math.max(30000, Math.round(jittered)));
};

/**
 * The next moment the daily allowance could possibly have refilled.
 *
 * Used when a chunk stops because the day's sending is spent. Retrying in
 * fifteen minutes would just fail again, fifty times before midnight, and
 * fill the log with it. Ten past midnight in the program's own timezone -
 * ten minutes of slack because the provider's reset and ours are not
 * guaranteed to agree to the second.
 */
const nextAllowanceReset = (from = new Date()) => {
  // Where midnight falls depends on the timezone the quota is counted in,
  // so the offset is measured rather than assumed.
  const local = new Date(
    from.toLocaleString("en-US", { timeZone: quota.TIMEZONE })
  );
  const offsetMs = from.getTime() - local.getTime();

  const tomorrow = new Date(local);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 10, 0, 0);

  return new Date(tomorrow.getTime() + offsetMs);
};

/** Random pause between two individual messages, in milliseconds. */
const perMessageDelayMs = (campaign) => {
  const min = Math.max(0, Number(campaign.ec_min_gap_seconds) || 0);
  const max = Math.max(min, Number(campaign.ec_max_gap_seconds) || min);
  if (max === 0) return 0;
  return randomInt(min, max) * 1000;
};

/**
 * The message a campaign sends.
 *
 * Static, and identical for every recipient. Campaign email used to be
 * rendered per person - a built-in letter chosen by kind, with merge tokens
 * filled in from the candidate or student behind each row - which is why this
 * once needed the recipient and its joins. It no longer does: the operator
 * writes the HTML, and that HTML is what every address receives.
 *
 * Built once per chunk rather than per message, since the result cannot vary.
 *
 * `text` is left to sendEmail, which derives a plain-text alternative from the
 * HTML and wraps a fragment in the branded layout. A message with no text part
 * is itself a spam signal, so it must not be skipped.
 */
const renderCampaign = (campaign) => ({
  subject: campaign.ec_subject,
  html: campaign.ec_custom_html,
});

/**
 * Send a dummy copy of a campaign to the test addresses.
 *
 * Uses exactly the same render and the same transport as a real send, so what
 * lands in the test inbox is byte-for-byte what an applicant would receive -
 * only the candidate details are stand-ins. Anything less would let a template
 * fault through precisely because the test took a different path.
 *
 * Test copies are NOT written to email_campaign_recipients: they are not
 * applicants, and counting them would corrupt the campaign's progress figures
 * and the already-contacted ledger.
 *
 * Never throws. A failed proof must not stop the campaign being created.
 *
 * @returns {Promise<{sent: string[], failed: Array<{to: string, error: string}>}>}
 */
const sendTestCopies = async (campaign) => {
  const result = { sent: [], failed: [] };

  if (!isConfigured) {
    for (const to of TEST_RECIPIENTS) {
      result.failed.push({ to, error: "SMTP is not configured" });
    }
    return result;
  }

  const rendered = {
    ...renderCampaign(campaign),
    // Prefixed so a test copy can never be mistaken for the real thing in an
    // inbox that also receives genuine campaign mail. The body is untouched:
    // the proof has to be the real message, or it proves nothing.
    subject: `[TEST] ${campaign.ec_subject}`,
  };

  for (const to of TEST_RECIPIENTS) {
    try {
      await sendEmail({ to, ...rendered });
      result.sent.push(to);
    } catch (error) {
      const message = String(error?.message || error).slice(0, 300);
      result.failed.push({ to, error: message });
      console.error(`[campaign ${campaign.ec_id}] test copy to ${to} failed:`, message);
    }
  }

  return result;
};

/**
 * Release one chunk for a campaign.
 *
 * Returns how many were sent. Each message is committed individually so a
 * crash halfway through a chunk cannot cause the survivors to be re-sent.
 */
const sendChunk = async (campaign) => {
  const recipients = await EmailCampaignRecipient.findAll({
    where: {
      ec_id: campaign.ec_id,
      ecr_status: { [Op.in]: ["pending", "failed"] },
      ecr_attempts: { [Op.lt]: MAX_ATTEMPTS },
    },
    // No joins. A recipient is an address; there is nothing behind it to load,
    // and the message does not vary by person. The old candidate/student
    // includes were not just unnecessary work - the student one failed every
    // chunk with "user is associated to student using an alias".
    order: [["ecr_id", "ASC"]],
    limit: Math.max(1, Number(campaign.ec_batch_size) || 25),
  });

  if (recipients.length === 0) return 0;

  // Rendered once: identical for every address in this chunk.
  const { subject, html } = renderCampaign(campaign);

  let sent = 0;
  let stoppedForQuota = false;

  for (let index = 0; index < recipients.length; index += 1) {
    const recipient = recipients[index];

    // Re-read status: a pause or cancel may have landed while this chunk was
    // still draining, and it should take effect immediately rather than after
    // the whole chunk.
    await campaign.reload();
    if (campaign.ec_status !== "running") break;

    // Checked per message, not once per chunk: several campaigns can be
    // draining at the same time, and registration codes are being sent
    // alongside them, so the budget moves underneath a long chunk.
    //
    // Running out of Brevo allowance only ends the day's sending when there
    // is nowhere else to send from. With an SMTP server configured the
    // campaign carries on through it - at this same pace, because the
    // chunking and the gaps between messages are what keep a few hundred
    // emails from looking like a blast, and that matters more on the
    // program's own domain than it does on Brevo's.
    if (
      provider === "brevo" &&
      !canFallBackToSmtp &&
      (await quota.campaignBudget()) <= 0
    ) {
      stoppedForQuota = true;
      break;
    }

    try {
      await sendEmail({ to: recipient.ecr_email, subject, html });

      await recipient.update({
        ecr_status: "sent",
        ecr_sent_at: new Date(),
        ecr_attempts: recipient.ecr_attempts + 1,
        ecr_error: null,
      });
      sent += 1;
    } catch (error) {
      const attempts = recipient.ecr_attempts + 1;
      await recipient.update({
        // Only give up once the retry budget is gone, so a transient SMTP
        // hiccup does not permanently drop someone from the campaign.
        ecr_status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
        ecr_attempts: attempts,
        ecr_error: String(error?.message || error).slice(0, 500),
      });
      console.error(
        `[campaign ${campaign.ec_id}] send to ${recipient.ecr_email} failed (attempt ${attempts}):`,
        error?.message || error
      );
    }

    if (index < recipients.length - 1) {
      await sleep(perMessageDelayMs(campaign));
    }
  }

  if (stoppedForQuota) {
    const usage = await quota.describe();
    console.log(
      `[campaign ${campaign.ec_id}] stopped after ${sent} message(s): today's allowance is spent ` +
        `(${usage.total}/${usage.dailyLimit}, ${usage.reserve} held back for registration codes) ` +
        "and no SMTP fallback is configured. The rest of this campaign goes out tomorrow."
    );
  }

  // The flag rides back on the count so runCampaign can reschedule for
  // tomorrow rather than for the usual interval.
  return { sent, stoppedForQuota };
};

/** Mark a campaign completed once nothing is left that could still be sent. */
const finaliseIfDone = async (campaign) => {
  const remaining = await EmailCampaignRecipient.count({
    where: {
      ec_id: campaign.ec_id,
      ecr_status: { [Op.in]: ["pending", "failed"] },
      ecr_attempts: { [Op.lt]: MAX_ATTEMPTS },
    },
  });

  if (remaining === 0) {
    await campaign.update({ ec_status: "completed", ec_next_run_at: null });
    console.log(`[campaign ${campaign.ec_id}] completed`);
    return true;
  }
  return false;
};

/** Drain one chunk for one campaign, then schedule its next one. */
const runCampaign = async (campaign) => {
  try {
    if (await finaliseIfDone(campaign)) return;

    if (!isConfigured) {
      console.error(
        `[campaign ${campaign.ec_id}] no email provider is configured - pausing instead of failing every recipient`
      );
      await campaign.update({ ec_status: "paused" });
      return;
    }

    // Claim the slot before any awaiting work so the next poll, which may fire
    // while this chunk is still draining, skips this campaign.
    const { sent, stoppedForQuota } = await sendChunk(campaign);
    const finishedAt = new Date();

    await campaign.reload();
    if (campaign.ec_status !== "running") return;

    await campaign.update({
      ec_last_run_at: finishedAt,
      ec_next_run_at: stoppedForQuota
        ? nextAllowanceReset(finishedAt)
        : computeNextRunAt(campaign, finishedAt),
    });

    console.log(
      `[campaign ${campaign.ec_id}] released ${sent} message(s); next chunk around ${
        campaign.ec_next_run_at?.toISOString?.() || "-"
      }`
    );

    await finaliseIfDone(campaign);
  } catch (error) {
    // One failing campaign must never take down the others.
    console.error(
      `[campaign ${campaign.ec_id}] chunk failed:`,
      error?.message || error
    );
  } finally {
    release(campaign.ec_id);
  }
};

/**
 * Start a chunk for every campaign that is running, due, and not already
 * draining. Campaigns are launched concurrently and deliberately not awaited:
 * a chunk can take many minutes, and waiting would serialise them.
 */
const tick = async () => {
  try {
    const capacity = MAX_CONCURRENT_CAMPAIGNS - inFlight.size;
    if (capacity <= 0) return;

    const now = new Date();
    const busy = [...inFlight];
    const due = await EmailCampaign.findAll({
      where: {
        ec_status: "running",
        // Skip anything already draining rather than filtering it out later,
        // so the LIMIT below is spent on campaigns that can actually start.
        ...(busy.length ? { ec_id: { [Op.notIn]: busy } } : {}),
        [Op.or]: [
          { ec_next_run_at: null },
          { ec_next_run_at: { [Op.lte]: now } },
        ],
      },
      // No center/batch join: the message no longer mentions either, so
      // loading them was work whose result was never read.
      // Oldest due first, so a campaign cannot be starved by newer ones
      // repeatedly winning the free slots.
      order: [["ec_next_run_at", "ASC"], ["ec_id", "ASC"]],
      limit: capacity,
    });

    for (const campaign of due) {
      if (!claim(campaign.ec_id)) continue;
      // Intentionally not awaited - see the doc comment above.
      void runCampaign(campaign);
    }
  } catch (error) {
    // Never let a bad poll kill the scheduler.
    console.error("[campaign dispatcher] tick failed:", error?.message || error);
  }
};

const start = () => {
  if (timer) return;

  // Switched off in config/features.js. Returning here is what makes the
  // switch mean something: closing the endpoints only stops NEW campaigns,
  // while anything already in `running` would carry on draining from the
  // database on the next tick, which is exactly what turning the module off
  // is meant to prevent. Nothing is lost - progress is per recipient, so a
  // campaign resumes at the next unsent address when the switch goes back on.
  if (!EMAIL_CAMPAIGNS_ENABLED) {
    console.log(
      "[campaign dispatcher] not started: the email campaign module is off",
      "(set EMAIL_CAMPAIGNS_ENABLED=true to re-enable)"
    );
    return;
  }
  timer = setInterval(() => {
    tick().catch((error) =>
      console.error("[campaign dispatcher] unhandled:", error?.message || error)
    );
  }, POLL_INTERVAL_MS);

  // `unref` so the timer alone never keeps the process alive.
  if (typeof timer.unref === "function") timer.unref();
  console.log("[campaign dispatcher] started");
};

const stop = () => {
  if (timer) clearInterval(timer);
  timer = null;
};

module.exports = {
  start,
  stop,
  tick,
  claim,
  release,
  sendChunk,
  sendTestCopies,
  TEST_RECIPIENTS,
  computeNextRunAt,
  nextAllowanceReset,
  perMessageDelayMs,
  MAX_ATTEMPTS,
  MAX_CONCURRENT_CAMPAIGNS,
  _inFlight: inFlight,
};
