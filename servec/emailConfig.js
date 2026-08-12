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

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE, // true => implicit TLS (465), false => STARTTLS (587)
  requireTLS: !SMTP_SECURE, // force STARTTLS when not using implicit TLS
  auth: { user: SMTP_USER, pass: SMTP_PASS },
  tls: {
    rejectUnauthorized: SMTP_REJECT_UNAUTHORIZED,
    servername: SMTP_HOST,
  },
  // Reuse connections instead of opening one socket per message. Bulk senders
  // (class announcements) would otherwise hit the server's connection limit.
  pool: true,
  maxConnections: 2,
  maxMessages: 50,
  rateDelta: 1000,
  rateLimit: 5,
  // Without timeouts a stalled SMTP server hangs the HTTP request forever.
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 30000,
  logger: SMTP_DEBUG,
  debug: SMTP_DEBUG,
});

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

  try {
    const info = await transporter.sendMail({
      from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_ADDRESS}>`,
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      replyTo: options.replyTo || process.env.SMTP_REPLY_TO || undefined,
      subject: options.subject,
      text: bodyText,
      html: bodyHtml,
      attachments: options.attachments,
    });

    console.log(
      `[email] sent "${options.subject}" to ${options.to} (id: ${info.messageId})`
    );
    return info;
  } catch (error) {
    // Surface the underlying SMTP failure - the generic message alone makes
    // TLS/auth/timeout problems indistinguishable in the logs.
    console.error(
      `[email] FAILED to send "${options.subject}" to ${options.to}:`,
      `code=${error.code || "-"}`,
      `command=${error.command || "-"}`,
      `response=${error.response || "-"}`,
      error.message
    );
    throw error;
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

/** Check host reachability + credentials without sending a message. */
const verifyTransport = async () => {
  if (!isConfigured) return false;
  try {
    await transporter.verify();
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
module.exports.verifyTransport = verifyTransport;
module.exports.transporter = transporter;
module.exports.escapeHtml = escapeHtml;
module.exports.isConfigured = isConfigured;
