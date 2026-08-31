/**
 * Regression tests for the registration code endpoint.
 *
 * Run with:  node controllers/emailVerificationController.test.js
 * Exits non-zero if any rule regresses. No test framework, no database, no SMTP.
 *
 * The behaviour under test is what an applicant experiences when the mail
 * server is slow or broken, which is where this went wrong:
 *
 *   - The request used to be held open for the whole SMTP round trip, so a
 *     slow mail server became a spinner that ran until it gave up.
 *   - The send allowance was spent before the send was attempted and never
 *     handed back, so a failed send told the applicant to try again and then
 *     refused them for a minute when they did.
 */
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

// A short wait keeps the "slow mail server" cases quick. Must be set before the
// controller is required - it reads this once, at load.
process.env.VERIFY_SEND_WAIT_MS = "120";

// ---------------------------------------------------------------------------
// Stand-ins for the database row and the mail transport.
// ---------------------------------------------------------------------------

/** One row of email_verifications, with just enough Sequelize surface. */
const makeRow = (values) => ({
  ...values,
  async update(changes) {
    Object.assign(this, changes);
    return this;
  },
});

const store = { row: null };

stub("../models/emailVerificationModel", {
  async findOne() {
    return store.row;
  },
  async create(values) {
    store.row = makeRow(values);
    return store.row;
  },
});

/** Controlled by each test: resolve, reject, or never settle. */
const mail = { behaviour: () => Promise.resolve({ messageId: "<ok>" }) };

stub("../servec/emailConfig", {
  isConfigured: true,
  sendEmail: (...args) => mail.behaviour(...args),
});

stub("../servec/campaignTemplates", {
  verificationCode: ({ code }) => ({
    subject: `${code} is your code`,
    text: code,
    html: `<p>${code}</p>`,
  }),
});

stub("../utils/recordLogin", { resolveIp: () => ({ ip: "203.0.113.9" }) });

const controller = require("./emailVerificationController");

/** Minimal req/res pair that records what the handler answered. */
const call = async (body) => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  await controller.sendCode({ body, headers: {}, socket: {} }, res);
  return res;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60000);

(async () => {
  console.log("Rejecting what should be rejected");

  store.row = null;
  let res = await call({ email: "" });
  check("an empty address is refused", res.statusCode === 400, res.statusCode);

  res = await call({ email: "not-an-address" });
  check("a malformed address is refused", res.statusCode === 400, res.statusCode);

  console.log("\nThe mail server is healthy");

  store.row = null;
  mail.behaviour = () => Promise.resolve({ messageId: "<ok>" });
  const startedAt = Date.now();
  res = await call({ email: "Applicant@Example.Test" });
  const elapsed = Date.now() - startedAt;

  check("a code is accepted", res.statusCode === 200 && res.body.success === true);
  check(
    "the address is stored lower-cased",
    store.row?.ev_email === "applicant@example.test",
    store.row?.ev_email
  );
  check(
    "the code is stored hashed, never in the clear",
    typeof store.row?.ev_code_hash === "string" &&
      store.row.ev_code_hash.length === 64,
    store.row?.ev_code_hash
  );
  check(
    "the applicant is told it was sent",
    /we sent/i.test(res.body.message),
    res.body.message
  );
  check(
    "a healthy send is not delayed by the safety wait",
    elapsed < 100,
    `${elapsed}ms`
  );

  console.log("\nThe mail server is slow");

  store.row = null;
  // Never settles: the worst case, a mail server that has stopped answering.
  let releaseHung = null;
  mail.behaviour = () =>
    new Promise((resolve) => {
      releaseHung = resolve;
    });

  const slowStart = Date.now();
  res = await call({ email: "slow@example.test" });
  const slowElapsed = Date.now() - slowStart;

  check(
    "the applicant is answered instead of being left waiting",
    res.statusCode === 200 && res.body.success === true,
    `${res.statusCode} ${JSON.stringify(res.body)}`
  );
  check(
    "the wait is bounded",
    slowElapsed >= 120 && slowElapsed < 1000,
    `${slowElapsed}ms`
  );
  check(
    "the wording promises arrival rather than claiming delivery",
    /on its way/i.test(res.body.message),
    res.body.message
  );
  check(
    "the code is already stored, so it works whenever it lands",
    typeof store.row?.ev_code_hash === "string",
    store.row?.ev_code_hash
  );
  if (releaseHung) releaseHung({ messageId: "<eventually>" });

  console.log("\nThe mail server refuses the message");

  store.row = null;
  mail.behaviour = () => Promise.reject(Object.assign(new Error("nope"), { code: "EAUTH" }));
  res = await call({ email: "broken@example.test" });

  check(
    "the failure is reported honestly",
    res.statusCode === 502 && res.body.success === false,
    res.statusCode
  );
  // The heart of the "try again" / "please wait 60 seconds" contradiction.
  check(
    "the send allowance is handed back, so a retry is allowed at once",
    store.row?.ev_sends === 0 && store.row?.ev_last_sent_at === null,
    JSON.stringify({
      ev_sends: store.row?.ev_sends,
      ev_last_sent_at: store.row?.ev_last_sent_at,
    })
  );

  res = await call({ email: "broken@example.test" });
  check(
    "and the retry is not met with a cooldown",
    res.statusCode === 502,
    `${res.statusCode} ${res.body?.message}`
  );

  console.log("\nThe mail server is slow AND then fails");

  store.row = null;
  let rejectLate = null;
  mail.behaviour = () =>
    new Promise((_resolve, reject) => {
      rejectLate = reject;
    });
  res = await call({ email: "late-fail@example.test" });
  check(
    "the applicant is answered before the outcome is known",
    res.statusCode === 200,
    res.statusCode
  );

  rejectLate(Object.assign(new Error("too late"), { code: "ESOCKET" }));
  await sleep(50);
  check(
    "the allowance is handed back once the failure arrives",
    store.row?.ev_sends === 0 && store.row?.ev_last_sent_at === null,
    JSON.stringify({
      ev_sends: store.row?.ev_sends,
      ev_last_sent_at: store.row?.ev_last_sent_at,
    })
  );

  console.log("\nAbuse limits still hold");

  mail.behaviour = () => Promise.resolve({ messageId: "<ok>" });
  store.row = makeRow({
    ev_email: "busy@example.test",
    ev_sends: 1,
    ev_last_sent_at: new Date(),
  });
  res = await call({ email: "busy@example.test" });
  check(
    "a second code within a minute is refused",
    res.statusCode === 429 && Number(res.body.retryAfter) > 0,
    `${res.statusCode} ${JSON.stringify(res.body)}`
  );

  store.row = makeRow({
    ev_email: "flooded@example.test",
    ev_sends: 5,
    ev_last_sent_at: minutesAgo(10),
  });
  res = await call({ email: "flooded@example.test" });
  check(
    "the sixth code in an hour is refused",
    res.statusCode === 429,
    res.statusCode
  );
  check(
    "and the refusal says how long the wait is",
    /\d+ minute/.test(res.body.message || ""),
    res.body.message
  );

  // An applicant who came back the next day must not still be blocked.
  store.row = makeRow({
    ev_email: "yesterday@example.test",
    ev_sends: 5,
    ev_last_sent_at: minutesAgo(24 * 60),
  });
  res = await call({ email: "yesterday@example.test" });
  check(
    "yesterday's attempts do not block today's",
    res.statusCode === 200 && store.row.ev_sends === 1,
    `${res.statusCode} sends=${store.row?.ev_sends}`
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((error) => {
  console.error("test run failed:", error);
  process.exit(1);
});
