const { Op } = require("sequelize");
const EmailCampaign = require("../models/emailCampaignModel");
const EmailCampaignRecipient = require("../models/emailCampaignRecipientModel");
const Candidate = require("../models/CandidateModel");
const Course = require("../models/course");
const Center = require("../models/center");
const TrainingBatch = require("../models/trainingBatcheModel");
const { sendEmail, isConfigured } = require("../servec/emailConfig");
const { interviewCall } = require("../servec/campaignTemplates");

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

/** Random pause between two individual messages, in milliseconds. */
const perMessageDelayMs = (campaign) => {
  const min = Math.max(0, Number(campaign.ec_min_gap_seconds) || 0);
  const max = Math.max(min, Number(campaign.ec_max_gap_seconds) || min);
  if (max === 0) return 0;
  return randomInt(min, max) * 1000;
};

/** Build the personalised message for one recipient row. */
const renderForRecipient = (campaign, recipient) => {
  const candidate = recipient.candidate || {};
  return interviewCall({
    name: recipient.ecr_name || candidate.cand_name,
    fatherName: candidate.cand_fathername,
    cnic: candidate.cand_cnic,
    phone: candidate.cand_phone,
    applicationId: candidate.cand_id,
    courseName:
      candidate.courses?.course_full_name || candidate.courses?.course_name,
    centerName: campaign.center?.center_name || candidate.centers?.center_name,
    batchName: campaign.batch?.tb_name,
    interviewDate: campaign.ec_interview_date,
    interviewTime: campaign.ec_interview_time,
    reportingTime: campaign.ec_reporting_time,
    venue: campaign.ec_venue,
    contactPerson: campaign.ec_contact_person,
    contactPhone: campaign.ec_contact_phone,
    message: campaign.ec_message,
    isReminder: campaign.ec_kind === "reminder",
    subject: campaign.ec_subject,
  });
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
    include: [
      {
        model: Candidate,
        as: "candidate",
        include: [
          {
            model: Course,
            as: "courses",
            attributes: ["course_name", "course_full_name"],
          },
          { model: Center, as: "centers", attributes: ["center_name"] },
        ],
      },
    ],
    order: [["ecr_id", "ASC"]],
    limit: Math.max(1, Number(campaign.ec_batch_size) || 25),
  });

  if (recipients.length === 0) return 0;

  let sent = 0;

  for (let index = 0; index < recipients.length; index += 1) {
    const recipient = recipients[index];

    // Re-read status: a pause or cancel may have landed while this chunk was
    // still draining, and it should take effect immediately rather than after
    // the whole chunk.
    await campaign.reload();
    if (campaign.ec_status !== "running") break;

    try {
      const { subject, text, html } = renderForRecipient(campaign, recipient);
      await sendEmail({ to: recipient.ecr_email, subject, text, html });

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

  return sent;
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
        `[campaign ${campaign.ec_id}] SMTP is not configured - pausing instead of failing every recipient`
      );
      await campaign.update({ ec_status: "paused" });
      return;
    }

    // Claim the slot before any awaiting work so the next poll, which may fire
    // while this chunk is still draining, skips this campaign.
    const sent = await sendChunk(campaign);
    const finishedAt = new Date();

    await campaign.reload();
    if (campaign.ec_status !== "running") return;

    await campaign.update({
      ec_last_run_at: finishedAt,
      ec_next_run_at: computeNextRunAt(campaign, finishedAt),
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
      include: [
        { model: Center, as: "center", attributes: ["center_name"] },
        { model: TrainingBatch, as: "batch", attributes: ["tb_name"] },
      ],
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
  computeNextRunAt,
  perMessageDelayMs,
  MAX_ATTEMPTS,
  MAX_CONCURRENT_CAMPAIGNS,
  _inFlight: inFlight,
};
