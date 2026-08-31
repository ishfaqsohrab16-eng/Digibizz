/**
 * Regression tests for provider failover.
 *
 * Run with:  node servec/emailFailover.test.js
 * Exits non-zero if any rule regresses. No network.
 *
 * This is the bug these exist for, in full:
 *
 *   Forgot password error: Today's campaign allowance is used up: 353 of 300
 *   sent... at sendThroughBrevo
 *
 * A password reset was refused while a perfectly good mail server sat idle next
 * to it, for two reasons. Running out of Brevo allowance THREW instead of
 * routing elsewhere; and the fallback was gated on options.priority, which that
 * caller did not pass - so the reset was also billed to the campaign budget.
 *
 * The rules now: a spent allowance is a routing decision, never an error. A
 * Brevo failure that definitely did not send falls back to SMTP for every kind
 * of mail. And anything neither provider can take is queued, not lost.
 */
const Module = require("module");

let passed = 0;
let failed = 0;

const check = (name, condition, detail) => {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? `  ->  ${detail}` : ""}`);
  }
};

const stub = (request, exports) => {
  const resolved = require.resolve(request);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports,
  };
};

// --- a fake nodemailer ------------------------------------------------------

const smtp = { calls: [], behaviour: null };

const makeFakeTransport = () => ({
  async sendMail(message) {
    smtp.calls.push(message);
    if (smtp.behaviour) return smtp.behaviour(message);
    return {
      messageId: "<smtp>",
      accepted: [message.to],
      rejected: [],
      response: "250 OK",
    };
  },
  async verify() {
    return true;
  },
  close() {},
});

stub("nodemailer", { createTransport: makeFakeTransport });
stub("dotenv", { config: () => ({ parsed: {} }) });

// --- a fake Brevo -----------------------------------------------------------

const brevo = { calls: 0, behaviour: null };

const brevoError = (message, extra) => Object.assign(new Error(message), extra);

stub("./providers/brevo", {
  isBrevoConfigured: true,
  SENDER_EMAIL: "noreply@example.test",
  SENDER_NAME: "Digibizz",
  async sendViaBrevo(payload) {
    brevo.calls += 1;
    if (brevo.behaviour) return brevo.behaviour(payload);
    return {
      messageId: "<brevo>",
      accepted: [payload.to],
      rejected: [],
      response: "201 accepted by Brevo",
    };
  },
  async verifyBrevo() {
    return { ok: true };
  },
  async deleteContact() {
    return { existed: false };
  },
  BrevoError: Error,
});

// --- a fake allowance -------------------------------------------------------

const allowance = {
  total: 0,
  dailyLimit: 300,
  reserve: 50,
  remainingForCampaigns: 250,
  remainingTotal: 300,
};

stub("../utils/emailQuota", {
  async describe() {
    return { ...allowance };
  },
  async campaignBudget() {
    return allowance.remainingForCampaigns;
  },
  async transactionalAllowed() {
    return allowance.remainingTotal > 0;
  },
  async record() {},
  TIMEZONE: "Asia/Karachi",
});

stub("../utils/brevoContactCleanup", { async remember() {} });

// --- a fake outbox ----------------------------------------------------------

const queued = [];
stub("../utils/emailOutbox", {
  async enqueue(options, reason) {
    queued.push({ options, reason });
    return { eo_id: queued.length };
  },
});

process.env.SMTP_HOST = "mail.example.test";
process.env.SMTP_USER = "noreply@example.test";
process.env.SMTP_PASS = "x";
process.env.BREVO_API_KEY = "key";
process.env.BREVO_SENDER_EMAIL = "noreply@example.test";
process.env.EMAIL_PROVIDER = "auto";
process.env.EMAIL_FALLBACK_TO_SMTP = "true";

const { sendEmail, provider } = require("./emailConfig");

const reset = () => {
  smtp.calls = [];
  smtp.behaviour = null;
  brevo.calls = 0;
  brevo.behaviour = null;
  queued.length = 0;
  allowance.total = 0;
  allowance.remainingForCampaigns = 250;
  allowance.remainingTotal = 300;
};

const message = (extra = {}) => ({
  to: "ali@example.com",
  subject: "Password Reset Verification Code",
  text: "123456",
  ...extra,
});

(async () => {
  check("Brevo is the selected provider", provider === "brevo", provider);

  console.log("\nWhile there is allowance\n");

  reset();
  let info = await sendEmail(message({ priority: true }));
  check("Brevo carries the message", brevo.calls === 1 && smtp.calls.length === 0);
  check("and says so", info.provider === "brevo", info.provider);

  console.log("\nWhen the allowance is gone - the reported bug\n");

  // 353 of 300, exactly the state in the report.
  reset();
  allowance.total = 353;
  allowance.remainingForCampaigns = 0;
  allowance.remainingTotal = 0;

  let threw = null;
  try {
    info = await sendEmail(message({ priority: true }));
  } catch (error) {
    threw = error;
  }

  check("the password reset does NOT fail", threw === null, String(threw));
  check("Brevo is not even asked", brevo.calls === 0, String(brevo.calls));
  check("SMTP sends it", smtp.calls.length === 1 && info.provider === "smtp", info?.provider);
  check("and nothing is queued, because it went out", queued.length === 0);

  // The other half of the bug: a caller that forgot priority:true was billed to
  // the campaign budget AND excluded from the fallback. Now it still goes.
  reset();
  allowance.total = 353;
  allowance.remainingForCampaigns = 0;
  allowance.remainingTotal = 0;

  threw = null;
  try {
    info = await sendEmail(message());
  } catch (error) {
    threw = error;
  }
  check(
    "a caller that forgot priority:true is still delivered",
    threw === null && info?.provider === "smtp",
    String(threw || info?.provider)
  );

  // Campaign mail hits the reserve first, while transactional still has room.
  reset();
  allowance.total = 250;
  allowance.remainingForCampaigns = 0;
  allowance.remainingTotal = 50;

  info = await sendEmail(message());
  check("campaign mail moves to SMTP at the reserve", info.provider === "smtp");

  reset();
  allowance.total = 250;
  allowance.remainingForCampaigns = 0;
  allowance.remainingTotal = 50;
  info = await sendEmail(message({ priority: true }));
  check(
    "but transactional mail may still spend the reserve on Brevo",
    info.provider === "brevo" && brevo.calls === 1,
    info.provider
  );

  console.log("\nWhen Brevo fails outright\n");

  // Brevo answered, or was never reached. Either way it did not send, so there
  // is no duplicate to fear - campaign mail falls back too.
  for (const [label, error] of [
    ["a spent allowance (402)", brevoError("no credits", { quotaExceeded: true })],
    ["a rejected key (401)", brevoError("bad key", { status: 401 })],
    ["a refused connection", brevoError("ECONNREFUSED", { code: "ECONNREFUSED" })],
  ]) {
    reset();
    brevo.behaviour = () => {
      throw error;
    };
    info = await sendEmail(message());
    check(`${label} falls back to SMTP`, info.provider === "smtp", info.provider);
  }

  console.log("\nWhen Brevo might have sent it anyway\n");

  // A timeout is ambiguous: the request may have been accepted with the reply
  // lost. A duplicate code is harmless; a duplicate campaign email is not.
  reset();
  brevo.behaviour = () => {
    throw brevoError("Brevo did not answer within 15000ms", { code: "ETIMEDOUT" });
  };
  info = await sendEmail(message({ priority: true }));
  check("a timeout on a code falls back", info.provider === "smtp", info.provider);

  reset();
  brevo.behaviour = () => {
    throw brevoError("Brevo did not answer within 15000ms", { code: "ETIMEDOUT" });
  };
  info = await sendEmail(message());
  check(
    "a timeout on campaign mail does NOT re-send through SMTP",
    smtp.calls.length === 0,
    String(smtp.calls.length)
  );
  check("it is queued instead, so it is not lost either", queued.length === 1);

  console.log("\nWhen the mail server lies about it\n");

  // Poste/Haraka will accept for one recipient and refuse another in the same
  // call. nodemailer reports that in `rejected` without throwing, which would
  // otherwise be recorded as a successful send to somebody who got nothing.
  reset();
  allowance.remainingTotal = 0;
  allowance.remainingForCampaigns = 0;
  smtp.behaviour = () => ({
    messageId: "<x>",
    accepted: [],
    rejected: ["ali@example.com"],
    response: "550 no such user",
  });

  info = await sendEmail(message({ priority: true }));
  check("a refused recipient is not called a success", info.queued === true, JSON.stringify(info));
  check(
    "and the reason names the refusal",
    /refused/i.test(queued[0]?.reason || ""),
    queued[0]?.reason
  );

  console.log("\nWhen nothing works\n");

  reset();
  brevo.behaviour = () => {
    throw brevoError("brevo down", { status: 500, retryable: true });
  };
  smtp.behaviour = () => {
    throw new Error("smtp down");
  };

  info = await sendEmail(message({ priority: true }));
  check("the message is queued rather than lost", info.queued === true);
  check("the caller is told it was queued", Boolean(info.outboxId));
  check("the body is handed to the outbox intact", queued[0]?.options?.text === "123456");

  // The drain and the dead-letter alert must never queue: one would duplicate
  // rows, the other would loop.
  reset();
  brevo.behaviour = () => {
    throw brevoError("brevo down", { status: 500, retryable: true });
  };
  smtp.behaviour = () => {
    throw new Error("smtp down");
  };
  threw = null;
  try {
    await sendEmail(message({ priority: true, noQueue: true }));
  } catch (error) {
    threw = error;
  }
  check("noQueue throws instead of queuing", threw !== null && queued.length === 0);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((error) => {
  console.error("test run failed:", error);
  process.exit(1);
});
