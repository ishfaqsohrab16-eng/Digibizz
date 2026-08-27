const crypto = require("crypto");
const EmailVerification = require("../models/emailVerificationModel");
const { sendEmail, isConfigured } = require("../servec/emailConfig");
const { verificationCode } = require("../servec/campaignTemplates");
const { resolveIp } = require("../utils/recordLogin");

/**
 * Email ownership check for the public registration form.
 *
 * Applicants are told their interview date by email, so a mistyped address
 * means they never hear from the program at all. This confirms the address
 * while they are still on the form, which is the only moment it can be fixed.
 *
 * These endpoints are unauthenticated by necessity - the applicant has no
 * account yet - which makes them a way to send mail to arbitrary addresses.
 * Every limit below exists for that reason, not for tidiness.
 */

const CODE_LENGTH = 6;
const CODE_TTL_MINUTES = 15;
/** Wrong guesses allowed before the code is burned. */
const MAX_ATTEMPTS = 5;
/** Codes per address per window, so it cannot be used to mail-bomb someone. */
const MAX_SENDS_PER_WINDOW = 5;
const SEND_WINDOW_MINUTES = 60;
/** Minimum gap between two sends to the same address. */
const RESEND_COOLDOWN_SECONDS = 60;

const normaliseEmail = (value) => String(value || "").trim().toLowerCase();

const isValidEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 150;

/** Numeric code, generated with a CSPRNG rather than Math.random. */
const generateCode = () => {
  const max = 10 ** CODE_LENGTH;
  return String(crypto.randomInt(0, max)).padStart(CODE_LENGTH, "0");
};

const hashCode = (code, email) =>
  crypto.createHash("sha256").update(`${email}:${code}`).digest("hex");

/**
 * Constant-time comparison.
 *
 * A plain `===` on the hashes leaks, through timing, how many leading
 * characters matched - which over many attempts narrows the search. The codes
 * are short enough that this is worth doing properly.
 */
const hashesMatch = (a, b) => {
  const bufferA = Buffer.from(String(a || ""), "utf8");
  const bufferB = Buffer.from(String(b || ""), "utf8");
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
};

const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60000);

/** Send (or resend) a code to an address. */
exports.sendCode = async (req, res) => {
  try {
    const email = normaliseEmail(req.body?.email);

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Please enter your email address" });
    }
    if (!isValidEmail(email)) {
      return res
        .status(400)
        .json({ success: false, message: "That email address does not look valid" });
    }
    if (!isConfigured) {
      return res.status(503).json({
        success: false,
        message:
          "Email is not available right now. Please try again shortly or contact the center.",
      });
    }

    const now = new Date();
    let record = await EmailVerification.findOne({ where: { ev_email: email } });

    if (record) {
      // Cooldown, so a held-down button cannot fire a burst of mail.
      if (
        record.ev_last_sent_at &&
        now.getTime() - new Date(record.ev_last_sent_at).getTime() <
          RESEND_COOLDOWN_SECONDS * 1000
      ) {
        const wait = Math.ceil(
          (RESEND_COOLDOWN_SECONDS * 1000 -
            (now.getTime() - new Date(record.ev_last_sent_at).getTime())) /
            1000
        );
        return res.status(429).json({
          success: false,
          message: `Please wait ${wait} more second(s) before asking for another code.`,
          retryAfter: wait,
        });
      }

      // The send counter resets once the window has passed, so a legitimate
      // applicant returning tomorrow is not still blocked from yesterday.
      const windowStart = minutesAgo(SEND_WINDOW_MINUTES);
      if (!record.ev_last_sent_at || new Date(record.ev_last_sent_at) < windowStart) {
        record.ev_sends = 0;
      }

      if (record.ev_sends >= MAX_SENDS_PER_WINDOW) {
        return res.status(429).json({
          success: false,
          message:
            "Too many codes have been requested for this address. Please try again in an hour.",
        });
      }
    }

    const code = generateCode();
    const values = {
      ev_email: email,
      ev_code_hash: hashCode(code, email),
      ev_expires_at: new Date(now.getTime() + CODE_TTL_MINUTES * 60000),
      // A fresh code resets the guess budget; the old code is now dead.
      ev_attempts: 0,
      ev_sends: (record?.ev_sends || 0) + 1,
      ev_last_sent_at: now,
      ev_ip: resolveIp(req).ip,
    };

    if (record) {
      await record.update(values);
    } else {
      record = await EmailVerification.create(values);
    }

    const { subject, text, html } = verificationCode({
      code,
      expiresInMinutes: CODE_TTL_MINUTES,
    });

    try {
      await sendEmail({ to: email, subject, text, html });
    } catch (error) {
      console.error(`[verify] could not send a code to ${email}:`, error?.message || error);
      return res.status(502).json({
        success: false,
        message:
          "We could not send the code. Please check the address is correct and try again.",
      });
    }

    return res.json({
      success: true,
      message: `We sent a ${CODE_LENGTH}-digit code to ${email}. It expires in ${CODE_TTL_MINUTES} minutes.`,
      expiresInMinutes: CODE_TTL_MINUTES,
      resendAfterSeconds: RESEND_COOLDOWN_SECONDS,
    });
  } catch (error) {
    console.error("Send verification code error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error sending the code" });
  }
};

/** Check a code and mark the address verified. */
exports.verifyCode = async (req, res) => {
  try {
    const email = normaliseEmail(req.body?.email);
    const code = String(req.body?.code || "").trim();

    if (!email || !code) {
      return res
        .status(400)
        .json({ success: false, message: "Enter the code we emailed you" });
    }

    const record = await EmailVerification.findOne({ where: { ev_email: email } });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "No code has been sent to that address yet",
      });
    }

    // Already done: return success rather than an error, so a double-click or
    // a page refresh does not look like a failure to the applicant.
    if (record.ev_verified_at) {
      return res.json({ success: true, verified: true, message: "Email already verified" });
    }

    if (new Date(record.ev_expires_at) < new Date()) {
      return res.status(410).json({
        success: false,
        message: "That code has expired. Please request a new one.",
      });
    }

    if (record.ev_attempts >= MAX_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: "Too many incorrect attempts. Please request a new code.",
      });
    }

    if (!hashesMatch(record.ev_code_hash, hashCode(code, email))) {
      await record.update({ ev_attempts: record.ev_attempts + 1 });
      const left = Math.max(MAX_ATTEMPTS - (record.ev_attempts + 1), 0);
      return res.status(400).json({
        success: false,
        message: left
          ? `That code is not correct. ${left} attempt(s) left.`
          : "That code is not correct. Please request a new one.",
        attemptsLeft: left,
      });
    }

    await record.update({ ev_verified_at: new Date(), ev_attempts: 0 });

    return res.json({
      success: true,
      verified: true,
      message: "Email address confirmed",
    });
  } catch (error) {
    console.error("Verify code error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error checking the code" });
  }
};

/** Whether an address has already been confirmed (survives a page refresh). */
exports.getStatus = async (req, res) => {
  try {
    const email = normaliseEmail(req.query?.email);
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const record = await EmailVerification.findOne({
      where: { ev_email: email },
      attributes: ["ev_verified_at"],
    });

    return res.json({ success: true, verified: Boolean(record?.ev_verified_at) });
  } catch (error) {
    console.error("Verification status error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error checking the address" });
  }
};

/**
 * Used by the registration handler to refuse an unverified address.
 * Exported rather than duplicated so the rule has one definition.
 */
exports.isEmailVerified = async (email) => {
  const record = await EmailVerification.findOne({
    where: { ev_email: normaliseEmail(email) },
    attributes: ["ev_verified_at"],
  });
  return Boolean(record?.ev_verified_at);
};

exports._internals = { generateCode, hashCode, hashesMatch, isValidEmail, normaliseEmail };
