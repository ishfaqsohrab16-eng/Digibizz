require("dotenv").config();
const nodemailer = require("nodemailer");
const {
  sendViaBrevo,
  verifyBrevo,
  isBrevoConfigured,
  SENDER_EMAIL: BREVO_SENDER,
} = require("./providers/brevo");

/**
 * Required lazily. This file is loaded by standalone scripts that have no
 * database, and the quota counter is only consulted when Brevo is carrying
 * the mail - so nothing here should pull in a model at require time.
 */
let quotaModule = null;
const quota = () => {
  if (!quotaModule) {
    // eslint-disable-next-line global-require
    quotaModule = require("../utils/emailQuota");
  }
  return quotaModule;
};

let outboxModule = null;
const outbox = () => {
  if (!outboxModule) {
    // eslint-disable-next-line global-require
    outboxModule = require("../utils/emailOutbox");
  }
  return outboxModule;
};

let cleanupModule = null;
const contactCleanup = () => {
  if (!cleanupModule) {
    // eslint-disable-next-line global-require
    cleanupModule = require("../utils/brevoContactCleanup");
  }
  return cleanupModule;
};

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

const isSmtpConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

/**
 * Which service actually carries the mail.
 *
 * "auto" (the default) uses Brevo when a key is present and falls back to
 * this deployment's own SMTP server otherwise, so adding BREVO_API_KEY to the
 * environment is the whole of the switchover and removing it is the whole of
 * the rollback. Force one or the other with EMAIL_PROVIDER=brevo | smtp.
 *
 * Brevo is preferred where available because it is an HTTPS request to a
 * public host, which an application container can always make - unlike SMTP
 * to a mail server sitting behind the same NAT, which is where this
 * deployment's undelivered registration codes came from.
 */
const EMAIL_PROVIDER = String(process.env.EMAIL_PROVIDER || "auto")
  .trim()
  .toLowerCase();

const provider =
  EMAIL_PROVIDER === "brevo"
    ? "brevo"
    : EMAIL_PROVIDER === "smtp"
    ? "smtp"
    : isBrevoConfigured
    ? "brevo"
    : "smtp";

/**
 * Fall back to SMTP for mail somebody is waiting on.
 *
 * Only for transactional mail, and only after Brevo has definitively
 * failed - most usefully when the free plan's daily allowance is spent, which
 * would otherwise stop applicants registering for the rest of the day. Never
 * for campaign mail: a fallback there could mail a real applicant twice.
 */
const FALLBACK_TO_SMTP =
  String(process.env.EMAIL_FALLBACK_TO_SMTP || "true").toLowerCase() !== "false" &&
  isSmtpConfigured;

/** True when SOMETHING can send. Callers use this to refuse work early. */
const isConfigured = provider === "brevo" ? isBrevoConfigured : isSmtpConfigured;

if (!isConfigured) {
  if (provider === "brevo") {
    console.error(
      "[email] Brevo is selected but not configured. Missing:",
      [
        !process.env.BREVO_API_KEY && "BREVO_API_KEY",
        !(process.env.BREVO_SENDER_EMAIL || SMTP_FROM_ADDRESS) &&
          "BREVO_SENDER_EMAIL (or SMTP_FROM)",
      ]
        .filter(Boolean)
        .join(", "),
      "- no emails will be sent."
    );
  } else {
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
} else {
  console.log(`[email] sending through ${provider}`);
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
/**
 * Whether a failed Brevo send may be tried again.
 *
 * 429 is Brevo asking us to slow down - it did not take the message, so a
 * retry cannot duplicate it, and that holds for campaign mail too. Any other
 * transient failure might have been accepted before the connection broke, so
 * only mail where a duplicate is harmless (a code, which is the same code
 * either way) is retried.
 */
const mayRetryBrevo = (error, attempt, options) => {
  if (attempt >= 2) return false;
  if (!error?.retryable) return false;
  if (error.status === 429) return true;
  return Boolean(options.priority);
};

/**
 * May this Brevo failure be re-sent through SMTP?
 *
 * The question is only ever: did Brevo definitely NOT take the message? If
 * it did not, sending it elsewhere cannot duplicate it, and that holds for
 * campaign mail as much as for a password reset.
 *
 * A refused key, a spent allowance, a rate limit and a refused connection
 * are all definite - Brevo answered, or was never reached. A TIMEOUT is not:
 * the request may have been accepted with the reply lost on the way back. So
 * timeouts fall back only for mail where a duplicate is harmless - a code is
 * the same code twice, while a campaign email arriving twice is a real cost.
 */
const AMBIGUOUS_CODES = new Set(["ETIMEDOUT", "ECONNRESET", "EPIPE"]);

const mayFallBackToSmtp = (error, options) => {
  if (!isSmtpConfigured) return false;
  if (error?.quotaExceeded) return true;

  const ambiguous =
    AMBIGUOUS_CODES.has(String(error?.code || "").toUpperCase()) ||
    /timed out|timeout/i.test(String(error?.message || ""));

  return ambiguous ? Boolean(options.priority) : true;
};

/**
 * Is there Brevo allowance left for this message?
 *
 * Campaign mail may spend down to the reserve; transactional mail may spend
 * everything, because a person is waiting on it and there is no later.
 *
 * Returns a reason string when there is not, rather than throwing. Running
 * out of a provider's daily allowance is a ROUTING decision - it means use
 * the other provider - and throwing made it look like a failure, which is
 * how a password reset ended up refused while a working mail server sat
 * idle next to it.
 */
const brevoAllowanceBlock = async (options) => {
  const kind = options.priority ? "transactional" : "campaign";
  const usage = await quota().describe();

  if (kind === "campaign" && usage.remainingForCampaigns <= 0) {
    return (
      `Brevo campaign allowance is used up: ${usage.total} of ${usage.dailyLimit} sent, ` +
      `with ${usage.reserve} held back for registration codes`
    );
  }
  if (usage.remainingTotal <= 0) {
    return `Brevo daily allowance is used up: ${usage.total} of ${usage.dailyLimit} sent`;
  }
  return null;
};

/** Send through Brevo, counting it against the day's allowance. */
const sendThroughBrevo = async (options, bodyHtml, bodyText) => {
  const kind = options.priority ? "transactional" : "campaign";

  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const startedAt = Date.now();
    try {
      const info = await sendViaBrevo({
        to: options.to,
        subject: options.subject,
        html: bodyHtml,
        text: bodyText,
        replyTo: options.replyTo || process.env.SMTP_REPLY_TO || undefined,
        cc: options.cc,
        bcc: options.bcc,
        attachments: options.attachments,
        tags: [kind],
      });

      console.log(
        `[email] sent "${options.subject}" to ${options.to}`,
        "| via=brevo",
        `| id=${info.messageId}`,
        `| ms=${Date.now() - startedAt}`,
        `| attempt=${attempt}`
      );

      // After the send, never before: a counter that ran ahead of reality
      // would refuse sends that the day still had room for.
      await quota().record(kind);

      // Note the address so its Brevo contact, if one was created, is
      // removed a day from now. Best-effort inside: a bookkeeping failure
      // must not turn a delivered email into an error.
      for (const address of info.accepted || []) {
        await contactCleanup().remember(address);
      }

      return info;
    } catch (error) {
      lastError = error;
      console.error(
        `[email] FAILED to send "${options.subject}" to ${options.to} via brevo:`,
        `status=${error.status || "-"}`,
        `code=${error.code || "-"}`,
        `ms=${Date.now() - startedAt}`,
        `attempt=${attempt}`,
        error.message
      );

      if (mayRetryBrevo(error, attempt, options)) {
        await new Promise((resolve) => setTimeout(resolve, 750));
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error("sendThroughBrevo: no attempt was made");
};

/**
 * One delivery attempt, right now.
 *
 * Tries Brevo when it is the provider and has allowance left, SMTP when it
 * does not. Throws if neither could take the message - the caller decides
 * whether that is fatal or something to queue.
 */
/**
 * Transactional unless the caller explicitly says otherwise.
 *
 * This default is the whole point. It used to be the other way round, and a
 * password reset that forgot `priority: true` was silently classified as
 * campaign mail - billed to the campaign budget, refused when that ran out,
 * and excluded from the SMTP fallback. Forgetting a flag should not decide
 * whether somebody can get back into their account.
 *
 * Bulk senders say so. There are two - the campaign dispatcher and class
 * announcements - and both are places where somebody is deliberately mailing
 * hundreds of people and knows it.
 */
const isBulk = (options) => options.bulk === true || options.priority === false;

const deliverNow = async (rawTo, rawSubject, rawText, rawHtml) => {
  const given =
    rawTo && typeof rawTo === "object" && !Array.isArray(rawTo)
      ? rawTo
      : { to: rawTo, subject: rawSubject, text: rawText, html: rawHtml };

  // One normalised flag from here down, so no call site can disagree with
  // another about what kind of mail this is.
  const options = { ...given, priority: !isBulk(given) };

  if (!isConfigured) {
    throw new Error(
      provider === "brevo"
        ? "Brevo is not configured (BREVO_API_KEY / BREVO_SENDER_EMAIL missing)"
        : "SMTP is not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing)"
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

  if (provider === "brevo") {
    // Checked BEFORE the request. When the allowance is gone there is
    // nothing to ask Brevo, and asking would only turn a routing decision
    // into an error to recover from.
    const blocked = FALLBACK_TO_SMTP ? await brevoAllowanceBlock(options) : null;

    if (blocked) {
      console.warn(
        `[email] ${blocked}; sending "${options.subject}" through SMTP instead`
      );
    } else {
      try {
        const info = await sendThroughBrevo(options, bodyHtml, bodyText);
        return { ...info, provider: "brevo" };
      } catch (error) {
        if (!FALLBACK_TO_SMTP || !mayFallBackToSmtp(error, options)) throw error;
        console.warn(
          `[email] brevo failed for "${options.subject}" (${error.message}); falling back to SMTP`
        );
      }
    }
  }

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

      // Confirm the server took it, rather than assuming a resolved promise
      // means delivery. Poste/Haraka will accept a message for one recipient
      // and refuse another in the same call, and nodemailer reports that in
      // `rejected` without throwing - which would otherwise be recorded as a
      // successful send to somebody who got nothing.
      if (Array.isArray(info.rejected) && info.rejected.length > 0) {
        const refused = new Error(
          `The mail server refused ${info.rejected.join(", ")}` +
            `${info.response ? ` (${info.response})` : ""}`
        );
        refused.code = "EREJECTED";
        throw refused;
      }
      if (Array.isArray(info.accepted) && info.accepted.length === 0) {
        const nobody = new Error(
          `The mail server accepted the message for nobody${info.response ? ` (${info.response})` : ""}`
        );
        nobody.code = "EREJECTED";
        throw nobody;
      }

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
      return { ...info, provider: "smtp" };
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
  throw lastError || new Error("deliverNow: no attempt was made");
};

/**
 * Send an email, and do not lose it.
 *
 * A message that cannot be handed over right now is written to the outbox and
 * retried until it goes out or is declared dead. That is what turns a spent
 * Brevo allowance, a mail server rebooting, or a minute of bad network into a
 * delay instead of a message nobody ever receives and nobody ever hears about.
 *
 * Resolving therefore means "accepted, or safely queued" - not "in their
 * inbox". Check `queued` on the result to tell the two apart. Callers that
 * must not queue - the outbox drain itself, and dead-letter alerts - pass
 * noQueue and get the plain throw.
 */
const sendEmail = async (to, subject, text, html) => {
  const given =
    to && typeof to === "object" && !Array.isArray(to)
      ? to
      : { to, subject, text, html };

  const options = { ...given, priority: !isBulk(given) };

  try {
    return await deliverNow(options);
  } catch (error) {
    // Queuing the drain's own sends would make a second row for the same
    // message on every failure; queuing an alert about a failed send would
    // start a loop.
    if (options.noQueue) throw error;

    // A bad recipient or an unconfigured provider will fail identically
    // forever. Queuing those just fills the table and delays the error.
    if (!isConfigured || !options.to) throw error;

    const row = await outbox().enqueue(options, error?.message || String(error));

    // Nothing holds the message now, so this really is a failure.
    if (!row) throw error;

    return {
      queued: true,
      outboxId: row.eo_id,
      accepted: [],
      rejected: [],
      messageId: null,
      response: `queued for retry: ${error?.message || error}`,
    };
  }
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
const verifySmtp = async () => {
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

/** Check host reachability + credentials without sending a message. */
const verifyTransport = async () => {
  if (!isConfigured) return false;

  if (provider === "brevo") {
    try {
      const account = await verifyBrevo();
      console.log(
        `[email] Brevo ready: ${account.email}`,
        `| plan=${account.planType || "-"}`,
        `| remaining today=${account.credits ?? "-"}`,
        `| from=${BREVO_SENDER}`
      );

      // Checked but not required: the fallback is a convenience, and a
      // broken SMTP server must not make a working Brevo look unhealthy.
      if (FALLBACK_TO_SMTP) {
        verifySmtp().then((ok) => {
          if (!ok) {
            console.warn(
              "[email] the SMTP fallback is not usable; if Brevo runs out of",
              "allowance, registration codes will fail until tomorrow"
            );
          }
        });
      }
      return true;
    } catch (error) {
      console.error(
        "[email] Brevo verification failed:",
        `status=${error.status || "-"}`,
        error.message
      );
      return false;
    }
  }

  return verifySmtp();
};

module.exports = sendEmail;
module.exports.sendEmail = sendEmail;
/** One attempt, no queuing. The outbox drain uses this. */
module.exports.deliverNow = deliverNow;
module.exports.sendEmailSafe = sendEmailSafe;
module.exports.sendPriorityEmail = sendPriorityEmail;
module.exports.verifyTransport = verifyTransport;
module.exports.transporter = transporter;
module.exports.priorityTransporter = priorityTransporter;
module.exports.escapeHtml = escapeHtml;
// Exported for the retry tests in ./emailConfig.test.js.
module.exports.isRetryable = isRetryable;
module.exports.isConfigured = isConfigured;
/** "brevo" or "smtp" - which service is actually carrying the mail. */
module.exports.provider = provider;
module.exports.isBrevoConfigured = isBrevoConfigured;
module.exports.isSmtpConfigured = isSmtpConfigured;
/**
 * Can a send that Brevo will not take still go out today?
 *
 * The campaign dispatcher asks this before deciding whether a spent Brevo
 * allowance means "pause until tomorrow" or "carry on through SMTP".
 */
module.exports.canFallBackToSmtp = FALLBACK_TO_SMTP;
/** Exported for the tests that check the transactional-by-default rule. */
module.exports.isBulk = isBulk;
