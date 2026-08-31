const { Op } = require("sequelize");
const EmailOutbox = require("../models/emailOutboxModel");

/**
 * The safety net under every send.
 *
 * A message that neither provider could carry right now is written to
 * email_outbox and retried until it goes out or is declared dead. Nothing is
 * dropped on the floor, and nothing sits in the queue silently forever - a
 * message that exhausts its attempts raises an alert naming the recipient and
 * the reason.
 *
 * The retries are what makes the Brevo daily allowance a delay rather than an
 * outage: a message queued at 6pm because the allowance was spent is picked up
 * again after midnight, when the allowance resets and the router prefers Brevo
 * once more. Nobody has to do anything.
 *
 * `deliver` is injected by servec/emailConfig rather than required here. The
 * two would otherwise require each other in a cycle, and the half-initialised
 * module that produces is a genuinely horrible thing to debug.
 */

/** Backoff between attempts, in minutes. The last value repeats. */
const BACKOFF_MINUTES = [1, 5, 15, 60, 180];

/** Attempts before a message is declared dead and someone is told. */
const MAX_ATTEMPTS = Number(process.env.EMAIL_OUTBOX_MAX_ATTEMPTS) || 8;

/** How often to look for messages that have come due. */
const DRAIN_INTERVAL_MS =
  Number(process.env.EMAIL_OUTBOX_DRAIN_SECONDS || 60) * 1000;

/**
 * Messages per drain.
 *
 * Enough to clear a normal backlog in one pass, small enough that a queue built
 * up over a provider outage does not become a burst that trips rate limits the
 * moment service returns.
 */
const BATCH_SIZE = Number(process.env.EMAIL_OUTBOX_BATCH || 25) || 25;

/** Where dead-letter alerts go. */
const ALERT_TO =
  process.env.EMAIL_ALERT_TO || process.env.SMTP_FROM || process.env.SMTP_USER || "";

let timer = null;
let draining = false;

/** Set by servec/emailConfig at load. See the note above about the cycle. */
let deliver = null;
const setDeliver = (fn) => {
  deliver = fn;
};

const truncate = (value, max) => {
  const text = String(value ?? "");
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
};

/** Comma-joined, because the column is a string and the caller may pass a list. */
const asAddressList = (value) => {
  if (!value) return null;
  const list = Array.isArray(value) ? value : [value];
  const joined = list
    .map((entry) => (typeof entry === "string" ? entry : entry?.address || entry?.email))
    .filter(Boolean)
    .join(", ");
  return joined || null;
};

const backoffFor = (attempts) =>
  BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length - 1)];

/**
 * Put a message beyond reach of losing it.
 *
 * Returns the row, or null when it could not be queued - which the caller must
 * treat as a real failure, because at that point nothing anywhere holds the
 * message.
 *
 * Messages with attachments are refused: buffers and streams cannot be written
 * to a column honestly, and a queued message that silently lost its attachment
 * is worse than one that failed loudly.
 */
const enqueue = async (options, reason) => {
  if (Array.isArray(options?.attachments) && options.attachments.length > 0) {
    console.error(
      `[outbox] not queuing "${options.subject}" to ${options.to}: it has attachments, ` +
        "which cannot be stored. The send has failed outright."
    );
    return null;
  }

  try {
    const row = await EmailOutbox.create({
      eo_to: truncate(asAddressList(options.to), 320),
      eo_cc: truncate(asAddressList(options.cc), 320),
      eo_bcc: truncate(asAddressList(options.bcc), 320),
      eo_reply_to: truncate(asAddressList(options.replyTo), 320),
      eo_subject: truncate(options.subject, 500),
      eo_text: options.text || null,
      eo_html: options.html || null,
      eo_priority: Boolean(options.priority),
      eo_status: "pending",
      eo_attempts: 0,
      // A minute out, not immediately: whatever just refused it is unlikely to
      // have changed its mind inside a second.
      eo_next_attempt_at: new Date(Date.now() + backoffFor(0) * 60000),
      eo_last_error: truncate(reason, 500),
    });

    console.warn(
      `[outbox] queued "${options.subject}" to ${options.to} for retry (#${row.eo_id}): ${reason}`
    );
    return row;
  } catch (error) {
    console.error(
      `[outbox] COULD NOT QUEUE "${options?.subject}" to ${options?.to}:`,
      error?.message || error,
      "- this message is lost"
    );
    return null;
  }
};

/**
 * Tell somebody a message is never going to arrive.
 *
 * Sent with noQueue so a failing alert cannot queue an alert about itself.
 */
const alertDeadLetter = async (row) => {
  if (!ALERT_TO || !deliver) return;

  const subject = `Email could not be delivered after ${row.eo_attempts} attempts`;
  const lines = [
    "A message has been abandoned after repeated delivery failures.",
    "",
    `To:       ${row.eo_to}`,
    `Subject:  ${row.eo_subject}`,
    `Attempts: ${row.eo_attempts}`,
    `Last error: ${row.eo_last_error}`,
    "",
    `It is row ${row.eo_id} in email_outbox, marked "dead". The content is still`,
    "there if it needs to be sent by hand.",
  ];

  try {
    await deliver({
      to: ALERT_TO,
      subject,
      text: lines.join("\n"),
      priority: true,
      noQueue: true,
    });
  } catch (error) {
    // Nothing further to try. The console is the last line of defence.
    console.error(
      `[outbox] could not send the dead-letter alert for #${row.eo_id}:`,
      error?.message || error
    );
  }
};

/** Send everything that has come due. */
const drain = async () => {
  if (!deliver) return { attempted: 0, sent: 0, failed: 0, dead: 0 };

  // A slow drain can outlast its own interval; overlapping runs would send the
  // same rows twice.
  if (draining) return { attempted: 0, sent: 0, failed: 0, dead: 0, busy: true };
  draining = true;

  const summary = { attempted: 0, sent: 0, failed: 0, dead: 0 };

  try {
    const due = await EmailOutbox.findAll({
      where: {
        eo_status: "pending",
        eo_next_attempt_at: { [Op.lte]: new Date() },
      },
      // Mail somebody is waiting on goes first, then oldest.
      order: [
        ["eo_priority", "DESC"],
        ["eo_next_attempt_at", "ASC"],
      ],
      limit: BATCH_SIZE,
    });

    for (const row of due) {
      summary.attempted += 1;
      const attempts = row.eo_attempts + 1;

      try {
        const info = await deliver({
          to: row.eo_to,
          cc: row.eo_cc || undefined,
          bcc: row.eo_bcc || undefined,
          replyTo: row.eo_reply_to || undefined,
          subject: row.eo_subject,
          text: row.eo_text || undefined,
          html: row.eo_html || undefined,
          priority: Boolean(row.eo_priority),
          // Already queued. Re-queuing on failure would make a second row for
          // the same message every time it failed.
          noQueue: true,
        });

        await row.update({
          eo_status: "sent",
          eo_attempts: attempts,
          eo_sent_at: new Date(),
          eo_provider: info?.provider || null,
          eo_message_id: truncate(info?.messageId, 255),
          eo_last_error: null,
        });
        summary.sent += 1;

        console.log(
          `[outbox] delivered #${row.eo_id} to ${row.eo_to} on attempt ${attempts}` +
            `${info?.provider ? ` via ${info.provider}` : ""}`
        );
      } catch (error) {
        const message = truncate(error?.message || error, 500);

        if (attempts >= MAX_ATTEMPTS) {
          await row.update({
            eo_status: "dead",
            eo_attempts: attempts,
            eo_last_error: message,
          });
          summary.dead += 1;

          console.error(
            `[outbox] GIVING UP on #${row.eo_id} to ${row.eo_to} after ${attempts} attempts: ${message}`
          );
          await alertDeadLetter(row);
        } else {
          await row.update({
            eo_attempts: attempts,
            eo_last_error: message,
            eo_next_attempt_at: new Date(Date.now() + backoffFor(attempts) * 60000),
          });
          summary.failed += 1;
        }
      }
    }

    if (summary.attempted > 0) {
      console.log(
        `[outbox] drained ${summary.attempted}: ${summary.sent} sent, ` +
          `${summary.failed} re-queued, ${summary.dead} abandoned`
      );
    }
  } catch (error) {
    console.error("[outbox] drain failed:", error?.message || error);
  } finally {
    draining = false;
  }

  return summary;
};

/** How much mail is waiting, for the log line at boot and for support. */
const pendingCount = async () => {
  try {
    return await EmailOutbox.count({ where: { eo_status: "pending" } });
  } catch {
    return 0;
  }
};

const start = () => {
  if (timer) return;

  timer = setInterval(() => {
    drain().catch((error) =>
      console.error("[outbox] unhandled:", error?.message || error)
    );
  }, DRAIN_INTERVAL_MS);

  if (typeof timer.unref === "function") timer.unref();

  console.log(
    `[outbox] started: retrying undelivered mail every ${Math.round(
      DRAIN_INTERVAL_MS / 1000
    )}s, up to ${MAX_ATTEMPTS} attempts`
  );

  // Anything queued before the last restart is due now, not in a minute.
  pendingCount().then((count) => {
    if (count > 0) {
      console.log(`[outbox] ${count} message(s) waiting from before this restart`);
      drain().catch(() => {});
    }
  });
};

const stop = () => {
  if (timer) clearInterval(timer);
  timer = null;
};

module.exports = {
  enqueue,
  drain,
  start,
  stop,
  setDeliver,
  pendingCount,
  MAX_ATTEMPTS,
  BACKOFF_MINUTES,
  _backoffFor: backoffFor,
};
