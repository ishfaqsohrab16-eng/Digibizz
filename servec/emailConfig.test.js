/**
 * Regression tests for transactional sending.
 *
 * Run with:  node servec/emailConfig.test.js
 * Exits non-zero if any rule regresses. No test framework, no real SMTP.
 *
 * What is being protected here is the reason registration codes went missing:
 * a single connection-level failure ended the applicant's attempt, and the
 * connection was likely to fail precisely because it had been kept open and
 * idle between codes. The transport is now unpooled and one retry is allowed,
 * and both of those are easy to undo by accident.
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

/**
 * Replace a module in the require cache before the module under test loads it.
 *
 * emailConfig builds its transports at require time from the environment, so
 * there is no seam to inject through afterwards - the substitution has to
 * happen first.
 */
const stub = (request, exports) => {
  const resolved = require.resolve(request);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports,
  };
  return resolved;
};

// ---------------------------------------------------------------------------
// A fake nodemailer whose transports record how they were configured and can
// be told to fail a given number of times before succeeding.
// ---------------------------------------------------------------------------

const transports = [];

const makeFakeTransport = (options) => {
  const transport = {
    options,
    calls: 0,
    /** Queue of errors to throw, one per call, before succeeding. */
    failures: [],
    async sendMail(message) {
      transport.calls += 1;
      const failure = transport.failures.shift();
      if (failure) throw failure;
      return {
        messageId: `<fake-${transport.calls}>`,
        accepted: [message.to],
        rejected: [],
        response: "250 OK",
      };
    },
    async verify() {
      return true;
    },
    close() {},
  };
  transports.push(transport);
  return transport;
};

stub("nodemailer", { createTransport: makeFakeTransport });

process.env.SMTP_HOST = "mail.example.test";
process.env.SMTP_USER = "noreply@example.test";
process.env.SMTP_PASS = "not-a-real-password";
process.env.SMTP_PORT = "465";

// dotenv would otherwise load the real .env over the top of these.
stub("dotenv", { config: () => ({ parsed: {} }) });

// Without this the failure paths below reach for a real database to queue
// the message, which is neither available nor the subject of these tests.
const queued = [];
stub("../utils/emailOutbox", {
  async enqueue(options, reason) {
    queued.push({ options, reason });
    return { eo_id: queued.length };
  },
});

const emailConfig = require("./emailConfig");
const { sendEmail, isRetryable } = emailConfig;

const [bulk, priority] = transports;

const socketError = (code) => {
  const error = new Error(`fake ${code}`);
  error.code = code;
  return error;
};

(async () => {
  console.log("Transport configuration");

  check(
    "the bulk transport is pooled",
    bulk.options.pool === true,
    JSON.stringify({ pool: bulk.options.pool })
  );

  // The regression that started this: a pooled transactional transport keeps
  // a connection open between codes, and the mail server closes it silently.
  check(
    "the transactional transport is NOT pooled",
    priority.options.pool === false,
    JSON.stringify({ pool: priority.options.pool })
  );

  check(
    "the transactional transport fails faster than the bulk one",
    priority.options.socketTimeout < bulk.options.socketTimeout &&
      priority.options.connectionTimeout < bulk.options.connectionTimeout,
    JSON.stringify({
      priority: priority.options.socketTimeout,
      bulk: bulk.options.socketTimeout,
    })
  );

  console.log("\nWhich failures are worth retrying");

  check("ECONNRESET is retryable", isRetryable(socketError("ECONNRESET")));
  check("ETIMEDOUT is retryable", isRetryable(socketError("ETIMEDOUT")));
  check("ESOCKET is retryable", isRetryable(socketError("ESOCKET")));
  check(
    "a coded-free socket close is retryable",
    isRetryable(new Error("Unexpected socket close"))
  );
  // Retrying these only doubles the wait: they fail the same way twice.
  check("a bad password is NOT retryable", !isRetryable(socketError("EAUTH")));
  check(
    "a rejected recipient is NOT retryable",
    !isRetryable(socketError("EENVELOPE"))
  );
  check("no error is not retryable", !isRetryable(null));

  console.log("\nRetry behaviour");

  priority.calls = 0;
  priority.failures = [socketError("ECONNRESET")];
  const recovered = await sendEmail({
    to: "applicant@example.test",
    subject: "123456 is your code",
    text: "123456",
    priority: true,
  });
  check(
    "a code survives one dropped connection",
    priority.calls === 2 && recovered.accepted[0] === "applicant@example.test",
    `calls=${priority.calls}`
  );

  priority.calls = 0;
  priority.failures = [socketError("ECONNRESET"), socketError("ECONNRESET")];
  let secondFailure = null;
  try {
    // noQueue so the throw is observable. Without it sendEmail would queue
    // the message and return - which is the right behaviour in production,
    // and exactly what hides the transport's own retry count from a test.
    await sendEmail({
      to: "applicant@example.test",
      subject: "code",
      text: "x",
      priority: true,
      noQueue: true,
    });
  } catch (error) {
    secondFailure = error;
  }
  check(
    "it gives up after one retry rather than looping",
    priority.calls === 2 && secondFailure !== null,
    `calls=${priority.calls}`
  );

  priority.calls = 0;
  priority.failures = [socketError("EAUTH")];
  let authFailure = null;
  try {
    await sendEmail({
      to: "applicant@example.test",
      subject: "code",
      text: "x",
      priority: true,
      noQueue: true,
    });
  } catch (error) {
    authFailure = error;
  }
  check(
    "a bad password is reported at once, not retried",
    priority.calls === 1 && authFailure?.code === "EAUTH",
    `calls=${priority.calls}`
  );

  // The dispatcher owns campaign retries, with its own per-recipient attempt
  // counter. Retrying here as well would risk mailing a real applicant twice.
  //
  // `bulk: true` is what makes this campaign mail. Mail is transactional
  // unless it says otherwise, because forgetting the flag used to mean a
  // password reset was billed to the campaign budget and refused.
  bulk.calls = 0;
  bulk.failures = [socketError("ECONNRESET")];
  let bulkFailure = null;
  try {
    await sendEmail({
      to: "list@example.test",
      subject: "campaign",
      text: "x",
      bulk: true,
      noQueue: true,
    });
  } catch (error) {
    bulkFailure = error;
  }
  check(
    "campaign mail is not retried here",
    bulk.calls === 1 && bulkFailure !== null,
    `calls=${bulk.calls}`
  );

  console.log("\nNothing is dropped on the way out");

  // Without noQueue, the same failure is caught and written to the outbox
  // rather than thrown away. That is the difference between a delayed
  // message and a lost one.
  queued.length = 0;
  priority.calls = 0;
  priority.failures = [socketError("ECONNRESET"), socketError("ECONNRESET")];
  const outcome = await sendEmail({
    to: "applicant@example.test",
    subject: "123456 is your code",
    text: "123456",
  });
  check("a send nobody could make is queued, not thrown away", outcome?.queued === true);
  check(
    "with its body, so it can actually be resent",
    queued[0]?.options?.text === "123456",
    JSON.stringify(queued[0]?.options)
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((error) => {
  console.error("test run failed:", error);
  process.exit(1);
});
