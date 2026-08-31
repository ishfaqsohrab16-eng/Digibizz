/**
 * Regression tests for the outbox.
 *
 * Run with:  node utils/emailOutbox.test.js
 * Exits non-zero if any rule regresses. No database, no network.
 *
 * The promise this makes is that a message is never silently lost. What has to
 * hold for that to be true:
 *
 *   - a message that cannot be sent now is written down, with its body,
 *   - it is retried, with a backoff, until it goes out,
 *   - and when it finally cannot go out, somebody is TOLD rather than the row
 *     sitting in a table nobody reads.
 */
const stub = (request, exports) => {
  const resolved = require.resolve(request);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports,
  };
};

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

process.env.EMAIL_ALERT_TO = "ops@example.test";
process.env.EMAIL_OUTBOX_MAX_ATTEMPTS = "3";

// --- the table --------------------------------------------------------------

const table = { rows: [], nextId: 1 };

const makeRow = (values) => ({
  ...values,
  async update(changes) {
    Object.assign(this, changes);
    return this;
  },
});

stub("../models/emailOutboxModel", {
  async create(values) {
    const row = makeRow({ eo_id: table.nextId++, ...values });
    table.rows.push(row);
    return row;
  },
  async findAll({ limit }) {
    const now = new Date();
    return table.rows
      .filter(
        (row) =>
          row.eo_status === "pending" && new Date(row.eo_next_attempt_at) <= now
      )
      .sort((a, b) => Number(b.eo_priority) - Number(a.eo_priority))
      .slice(0, limit);
  },
  async count() {
    return table.rows.filter((row) => row.eo_status === "pending").length;
  },
});

const outbox = require("./emailOutbox");

// --- the sender -------------------------------------------------------------

const sender = { behaviour: async () => ({ messageId: "<ok>", provider: "smtp" }) };
const delivered = [];

outbox.setDeliver(async (options) => {
  delivered.push(options);
  return sender.behaviour(options);
});

const overdue = () => new Date(Date.now() - 60000);

(async () => {
  console.log("\nQueuing\n");

  table.rows = [];
  const row = await outbox.enqueue(
    {
      to: "ali@example.com",
      subject: "Your code",
      text: "123456",
      html: "<p>123456</p>",
      priority: true,
    },
    "Brevo daily allowance is used up"
  );

  check("a message is written down", table.rows.length === 1);
  check("with its body, so it can actually be resent", row.eo_html === "<p>123456</p>");
  check("and its reason", /allowance/.test(row.eo_last_error), row.eo_last_error);
  check("priority is kept", row.eo_priority === true);
  check("it starts pending", row.eo_status === "pending");
  // Not immediately: whatever just refused it has not changed its mind in a
  // second, and an instant retry is just a second failure.
  check(
    "the first retry is a little way out, not instant",
    new Date(row.eo_next_attempt_at).getTime() > Date.now() + 30000,
    String(row.eo_next_attempt_at)
  );

  // Buffers and streams cannot be written to a column honestly, and a queued
  // message that silently lost its attachment is worse than a loud failure.
  table.rows = [];
  const withAttachment = await outbox.enqueue(
    {
      to: "a@b.com",
      subject: "Report",
      attachments: [{ filename: "x.pdf", content: Buffer.from("x") }],
    },
    "smtp down"
  );
  check("a message with attachments is refused, not silently stripped", withAttachment === null);
  check("and nothing is written", table.rows.length === 0);

  console.log("\nDraining\n");

  table.rows = [];
  delivered.length = 0;
  await outbox.enqueue({ to: "a@b.com", subject: "One", text: "x" }, "boom");
  table.rows[0].eo_next_attempt_at = overdue();

  sender.behaviour = async () => ({ messageId: "<sent>", provider: "brevo" });
  let summary = await outbox.drain();

  check("the due message is sent", summary.sent === 1, JSON.stringify(summary));
  check("it is marked sent", table.rows[0].eo_status === "sent");
  check(
    "and records which provider carried it",
    table.rows[0].eo_provider === "brevo",
    table.rows[0].eo_provider
  );
  check("a sent row is not sent again", (await outbox.drain()).attempted === 0);

  // The drain must not re-queue its own sends: that would make a second row for
  // the same message every time it failed.
  check(
    "the drain asks not to be queued",
    delivered[0]?.noQueue === true,
    JSON.stringify(delivered[0])
  );

  table.rows = [];
  await outbox.enqueue({ to: "a@b.com", subject: "Later", text: "x" }, "boom");
  check("a message not yet due is left alone", (await outbox.drain()).attempted === 0);

  console.log("\nBacking off, then giving up\n");

  table.rows = [];
  delivered.length = 0;
  await outbox.enqueue({ to: "a@b.com", subject: "Doomed", text: "x" }, "boom");
  sender.behaviour = async () => {
    throw new Error("mail server is down");
  };

  const target = table.rows[0];
  target.eo_next_attempt_at = overdue();
  summary = await outbox.drain();
  check("a failure is re-queued, not dropped", summary.failed === 1 && target.eo_status === "pending");
  check("the attempt is counted", target.eo_attempts === 1);
  check("the error is kept", /down/.test(target.eo_last_error), target.eo_last_error);

  const firstWait = new Date(target.eo_next_attempt_at).getTime() - Date.now();
  target.eo_next_attempt_at = overdue();
  await outbox.drain();
  const secondWait = new Date(target.eo_next_attempt_at).getTime() - Date.now();
  check(
    "each failure waits longer than the last",
    secondWait > firstWait,
    `${Math.round(firstWait / 1000)}s then ${Math.round(secondWait / 1000)}s`
  );

  // MAX_ATTEMPTS is 3 here. The third failure is the last.
  target.eo_next_attempt_at = overdue();
  summary = await outbox.drain();
  check("it is eventually declared dead", target.eo_status === "dead", target.eo_status);
  check("and counted as such", summary.dead === 1, JSON.stringify(summary));
  check("a dead row is not retried forever", (await outbox.drain()).attempted === 0);

  console.log("\nTelling somebody\n");

  // A row nobody looks at is the same as a lost message.
  const alert = delivered.find((message) => message.to === "ops@example.test");
  check("an alert is sent when a message is abandoned", Boolean(alert));
  check(
    "it names the recipient that missed out",
    /a@b\.com/.test(alert?.text || ""),
    alert?.text
  );
  check(
    "and the reason",
    /mail server is down/.test(alert?.text || ""),
    alert?.text
  );
  // Otherwise a failing alert queues an alert about the failed alert.
  check("the alert itself is never queued", alert?.noQueue === true);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((error) => {
  console.error("test run failed:", error);
  process.exit(1);
});
