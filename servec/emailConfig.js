require("dotenv").config();
const nodemailer = require("nodemailer");

/**
 * SMTP configuration.
 *
 * The Digibizz mail server (Poste.io / Haraka) presents a SELF-SIGNED
 * certificate, so Node rejects the TLS handshake with
 * `ESOCKET: self-signed certificate` unless verification is relaxed.
 * Previously this only worked because NODE_TLS_REJECT_UNAUTHORIZED=0 was set
 * globally, which disables certificate checks for the whole process (database,
 * outbound APIs, everything). We now scope that relaxation to the SMTP
 * transport only, so mail keeps working even without the global kill-switch.
 *
 * Set SMTP_TLS_REJECT_UNAUTHORIZED=true once the mail server has a valid
 * (e.g. Let's Encrypt) certificate.
 */
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

// `secure` must be a boolean. Default from the port when not provided.
const SMTP_SECURE =
  process.env.SMTP_SECURE !== undefined
    ? String(process.env.SMTP_SECURE).toLowerCase() === "true"
    : SMTP_PORT === 465;

const SMTP_REJECT_UNAUTHORIZED =
  String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED).toLowerCase() === "true";

const SMTP_FROM_ADDRESS = process.env.SMTP_FROM || SMTP_USER;
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || "Digibizz Program";
const SMTP_DEBUG = String(process.env.SMTP_DEBUG).toLowerCase() === "true";

const isConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

if (!isConfigured) {
  console.error(
    "[email] SMTP is not configured. Missing:",
    [
      !SMTP_HOST && "SMTP_HOST",
      !SMTP_USER && "SMTP_USER",
      !SMTP_PASS && "SMTP_PASS",
    ]
      .filter(Boolean)
      .join(", "),
    "- no emails will be sent."
  );
}

const baseTransportOptions = {
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE, // true => implicit TLS (465), false => STARTTLS (587)
  requireTLS: !SMTP_SECURE, // force STARTTLS when not using implicit TLS
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  tls: {
    rejectUnauthorized: SMTP_REJECT_UNAUTHORIZED,
    servername: SMTP_HOST,
  },
  // Without timeouts a stalled SMTP server hangs the HTTP request forever.
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 30000,
  logger: SMTP_DEBUG,
  debug: SMTP_DEBUG,
};

/**
 * Bulk transport: campaigns and class announcements.
 *
 * Reuses connections instead of opening one socket per message, and is rate
 * limited so a campaign cannot flood the mail server.
 */
const transporter = nodemailer.createTransport({
  ...baseTransportOptions,
  pool: true,
  maxConnections: 2,
  maxMessages: 50,
  rateDelta: 1000,
  rateLimit: 5,
});

/**
 * Transactional transport: verification codes, password resets - anything a
 * person is sitting in front of a form waiting for.
 *
 * These used to share the bulk pool above. nodemailer queues a message when
 * every pooled connection is busy and additionally holds it back to honour
 * `rateLimit`, so while a campaign was running a registration code waited
 * behind that campaign's messages - and because the send is awaited before the
 * HTTP response, the applicant's browser waited with it. That is the "code
 * arrives very late" report.
 *
 * A separate transport means campaign traffic and applicant traffic can never
 * queue behind one another. It is deliberately not rate limited: it carries
 * one message per human action, which the cooldown in the verification
 * controller already bounds.
 *
 * It is also deliberately NOT pooled, which the pooled version of this got
 * wrong. A pool holds the SMTP connection open between sends, and codes are
 * sporadic - minutes or hours apart. Mail servers close idle connections
 * (Poste.io/Haraka within a few minutes) and the client is not told. The next
 * code is then written to a socket the server has already dropped, and
 * nodemailer waits out socketTimeout before failing - so the applicant got
 * either a long spin ending in "could not send", or a code that arrived only
 * after they had given up. A fresh connection per message costs one
 * handshake, roughly a second, and cannot go stale.
 *
 * Timeouts are shorter than the bulk transport's for the same reason: a code
 * that takes thirty seconds has already failed as far as the person watching
 * the form is concerned. Better to fail quickly and let them press resend.
 */
const priorityTransporter = nodemailer.createTransport({
  ...baseTransportOptions,
  pool: false,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
});

/**
 * Failures where the message did not get through and a retry might succeed.
 *
 * Connection-level only. An authentication failure or a rejected recipient
 * fails identically the second time, so retrying those only doubles the wait
 * for someone sitting in front of a form.
 */
const RETRYABLE_CODES = new Set([
  "ECONNECTION",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ESOCKET",
  "EPIPE",
  "EDNS",
]);

const isRetryable = (error) => {
  if (!error) return false;
  if (RETRYABLE_CODES.has(String(error.code || "").toUpperCase())) return true;
  // Some socket failures arrive with no code at all, only a message.
  return /socket close|connection closed|timed out|read ECONNRESET|EPIPE/i.test(
    String(error.message || "")
  );
};

/** Escape untrusted values before interpolating them into HTML. */
const escapeHtml = (value) =>
  String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const hasVisibleContent = (html) =>
  typeof html === "string" &&
  html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;

const isFullDocument = (html) =>
  typeof html === "string" && /^\s*(<!doctype|<html)/i.test(html);

/** Very small HTML -> text fallback, used when a caller only supplies HTML. */
const htmlToText = (html) =>
  String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|tr|li)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const textToHtml = (text) =>
  escapeHtml(text).replace(/\r?\n/g, "<br />");

/**
 * Branded wrapper used for short/plain messages. Callers that pass a complete
 * HTML document (see templates in ./emailTemplates.js) bypass this.
 */
const renderLayout = (subject, bodyHtml) => `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
    <div style="text-align: center; margin-bottom: 20px;">
      <h2 style="color: #4CAF50; margin: 0;">Digibizz Program</h2>
      <p style="color: #555; font-size: 14px; margin: 4px 0 0;">Your trusted platform</p>
    </div>
    <div style="padding: 20px; background-color: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
      <h3 style="color: #333; margin: 0 0 12px;">${escapeHtml(subject)}</h3>
      <div style="color: #555; font-size: 14px; line-height: 1.6;">${bodyHtml}</div>
      <p style="color: #888; font-size: 13px; line-height: 1.6; margin-top: 20px;">If you did not request this, please ignore this email.</p>
    </div>
    <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
      <p>&copy; ${new Date().getFullYear()} Digibizz Program. All rights reserved.</p>
    </div>
  </div>
`;

/**
 * Send an email.
 *
 * Supports both the original positional signature and an options object:
 *   sendEmail(to, subject, text, html)
 *   sendEmail({ to, subject, text, html, replyTo, cc, bcc, attachments })
 *
 * Pass `priority: true` for mail a user is actively waiting on, so it goes out
 * on the transactional transport instead of queueing behind campaign sends.
 *
 * Note: `text` and `html` are two representations of the SAME message, not two
 * sections. The previous implementation rendered both, so recipients saw every
 * message twice. `html` wins when it has content; otherwise `text` is used.
 */
const sendEmail = async (to, subject, text, html) => {
  const options =
    to && typeof to === "object" && !Array.isArray(to)
      ? to
      : { to, subject, text, html };

  if (!isConfigured) {
    throw new Error(
      "SMTP is not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing)"
    );
  }

  if (!options.to) {
    throw new Error("sendEmail: no recipient specified");
  }

  const useHtml = hasVisibleContent(options.html);
  const bodyHtml = useHtml
    ? isFullDocument(options.html)
      ? options.html
      : renderLayout(options.subject, options.html)
    : renderLayout(options.subject, textToHtml(options.text));

  const bodyText =
    options.text && String(options.text).trim()
      ? options.text
      : htmlToText(options.html);

  const activeTransport = options.priority ? priorityTransporter : transporter;

  const message = {
    from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_ADDRESS}>`,
    to: options.to,
    cc: options.cc,
    bcc: options.bcc,
    replyTo: options.replyTo || process.env.SMTP_REPLY_TO || undefined,
    subject: options.subject,
    text: bodyText,
    html: bodyHtml,
    attachments: options.attachments,
  };

  /**
   * One retry, for transactional mail only.
   *
   * A dropped connection used to end the applicant's attempt outright: the
   * code was never sent and they were told to try again, having done nothing
   * wrong. Retrying once turns the common transient failure into a delay of a
   * second rather than a dead end.
   *
   * Campaign mail deliberately does not retry here. The dispatcher owns that,
   * with a per-recipient attempt counter, and a duplicate campaign email to a
   * real applicant is worth avoiding. A duplicate verification email is not -
   * it carries the same code either way.
   */
  const attempts = options.priority ? 2 : 1;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const startedAt = Date.now();
    try {
      const info = await activeTransport.sendMail(message);

      // Log what the SMTP server actually answered. "accepted" only means the
      // server took responsibility for the message - if it later fails to
      // relay (spam rejection, bad DKIM, blocklist) that shows up in the mail
      // server's own queue/logs and as a bounce to SMTP_FROM, never here.
      //
      // ms is the round trip to the mail server. If codes are arriving late
      // and this number is small, the delay is downstream - the mail server's
      // own queue, or greylisting at the recipient - and not in this app.
      console.log(
        `[email] sent "${options.subject}" to ${options.to}`,
        `| id=${info.messageId}`,
        `| ms=${Date.now() - startedAt}`,
        `| attempt=${attempt}`,
        `| accepted=${JSON.stringify(info.accepted || [])}`,
        `| rejected=${JSON.stringify(info.rejected || [])}`,
        `| response=${info.response || "-"}`
      );
      return info;
    } catch (error) {
      lastError = error;

      // Surface the underlying SMTP failure - the generic message alone makes
      // TLS/auth/timeout problems indistinguishable in the logs.
      console.error(
        `[email] FAILED to send "${options.subject}" to ${options.to}:`,
        `code=${error.code || "-"}`,
        `command=${error.command || "-"}`,
        `response=${error.response || "-"}`,
        `ms=${Date.now() - startedAt}`,
        `attempt=${attempt}/${attempts}`,
        error.message
      );

      if (attempt < attempts && isRetryable(error)) {
        await new Promise((resolve) => setTimeout(resolve, 750));
        continue;
      }
      throw error;
    }
  }

  // Unreachable: the loop either returns or throws. Kept so a later change to
  // the loop bounds cannot silently return undefined.
  throw lastError || new Error("sendEmail: no attempt was made");
};

/**
 * Fire-and-forget send: never rejects, never blocks the caller's response.
 * Use for notification emails that must not fail the surrounding request.
 */
const sendEmailSafe = (...args) =>
  Promise.resolve()
    .then(() => sendEmail(...args))
    .then(() => true)
    .catch(() => false);

/**
 * Send mail a user is waiting on, over the transactional transport.
 * Same signature as sendEmail.
 */
const sendPriorityEmail = async (to, subject, text, html) => {
  const options =
    to && typeof to === "object" && !Array.isArray(to)
      ? to
      : { to, subject, text, html };
  return sendEmail({ ...options, priority: true });
};

/** Check host reachability + credentials without sending a message. */
const verifyTransport = async () => {
  if (!isConfigured) return false;
  try {
    // Both transports. The transactional one is unpooled, so this leaves no
    // warm connection behind - it proves the host, TLS and credentials work
    // at boot, rather than on somebody's registration form.
    await Promise.all([transporter.verify(), priorityTransporter.verify()]);
    console.log(`[email] SMTP ready: ${SMTP_HOST}:${SMTP_PORT} (secure=${SMTP_SECURE})`);
    return true;
  } catch (error) {
    console.error(
      `[email] SMTP verification failed for ${SMTP_HOST}:${SMTP_PORT}:`,
      `code=${error.code || "-"}`,
      error.message
    );
    return false;
  }
};

module.exports = sendEmail;
module.exports.sendEmail = sendEmail;
module.exports.sendEmailSafe = sendEmailSafe;
module.exports.sendPriorityEmail = sendPriorityEmail;
module.exports.verifyTransport = verifyTransport;
module.exports.transporter = transporter;
module.exports.priorityTransporter = priorityTransporter;
module.exports.escapeHtml = escapeHtml;
// Exported for the retry tests in ./emailConfig.test.js.
module.exports.isRetryable = isRetryable;
module.exports.isConfigured = isConfigured;
