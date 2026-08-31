/**
 * Regression tests for the 24-hour contact cleanup.
 *
 * Run with:  node utils/brevoContactCleanup.test.js
 * Exits non-zero if any rule regresses. No database, no network.
 *
 * The job removes from the Brevo account every address this application mailed,
 * a day after mailing it. Two properties matter more than the mechanics:
 *
 *   - a row is destroyed once it has been dealt with. The table is itself a list
 *     of email addresses, so keeping the rows would rebuild the very thing the
 *     cleanup exists to prevent.
 *   - 404 from Brevo is success. Brevo's transactional endpoint is documented as
 *     not creating contacts, so "there was nothing there" is the expected answer
 *     and must not be recorded as a failure to retry forever.
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

process.env.BREVO_CONTACT_TTL_HOURS = "24";

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

// --- the table --------------------------------------------------------------

const table = { rows: [] };

const makeRow = (values) => ({
  ...values,
  destroyed: false,
  async update(changes) {
    Object.assign(this, changes);
    return this;
  },
  async destroy() {
    this.destroyed = true;
    table.rows = table.rows.filter((row) => row !== this);
    return this;
  },
});

stub("../models/brevoContactModel", {
  async findOrCreate({ where, defaults }) {
    const existing = table.rows.find((row) => row.bc_email === where.bc_email);
    if (existing) return [existing, false];
    const row = makeRow({ bc_attempts: 0, bc_last_error: null, ...defaults });
    table.rows.push(row);
    return [row, true];
  },
  async findAll({ limit }) {
    // The real query filters on bc_delete_after <= now and bc_attempts < MAX.
    const now = new Date();
    return table.rows
      .filter((row) => new Date(row.bc_delete_after) <= now && row.bc_attempts < 5)
      .slice(0, limit);
  },
});

// --- Brevo ------------------------------------------------------------------

const brevo = { behaviour: async () => ({ existed: false }) };

stub("../servec/providers/brevo", {
  isBrevoConfigured: true,
  deleteContact: (email) => brevo.behaviour(email),
});

const cleanup = require("./brevoContactCleanup");

const hoursAgo = (hours) => new Date(Date.now() - hours * 3600 * 1000);
const hoursAhead = (hours) => new Date(Date.now() + hours * 3600 * 1000);

(async () => {
  console.log("\nRemembering an address\n");

  table.rows = [];
  await cleanup.remember("Ali@Example.com");
  check("one row is written", table.rows.length === 1, String(table.rows.length));
  check(
    "the address is lower-cased, so one person is not two rows",
    table.rows[0].bc_email === "ali@example.com",
    table.rows[0].bc_email
  );

  const dueIn = (new Date(table.rows[0].bc_delete_after) - Date.now()) / 3600000;
  check(
    "it comes due in about 24 hours",
    dueIn > 23.9 && dueIn < 24.1,
    `${dueIn.toFixed(2)}h`
  );

  // Mailing someone again must not delete their contact mid-conversation - that
  // would only mean deleting it again tomorrow.
  table.rows[0].bc_delete_after = hoursAhead(1);
  await cleanup.remember("ali@example.com");
  const pushed = (new Date(table.rows[0].bc_delete_after) - Date.now()) / 3600000;
  check("a second message pushes the deadline out", pushed > 23.9, `${pushed.toFixed(2)}h`);
  check("and does not create a second row", table.rows.length === 1);

  await cleanup.remember("");
  await cleanup.remember(null);
  check("a blank address is ignored", table.rows.length === 1);

  console.log("\nSweeping\n");

  table.rows = [];
  await cleanup.remember("later@example.com");
  let summary = await cleanup.sweep();
  check(
    "an address not yet due is left alone",
    summary.checked === 0 && table.rows.length === 1,
    JSON.stringify(summary)
  );

  table.rows = [];
  await cleanup.remember("gone@example.com");
  table.rows[0].bc_delete_after = hoursAgo(1);
  brevo.behaviour = async () => ({ existed: true });
  summary = await cleanup.sweep();
  check(
    "a due address is deleted from Brevo",
    summary.checked === 1 && summary.existed === 1,
    JSON.stringify(summary)
  );
  check(
    "and its row is destroyed, not kept as a record of who was mailed",
    table.rows.length === 0,
    JSON.stringify(table.rows)
  );

  // The expected case: Brevo never created a contact in the first place.
  table.rows = [];
  await cleanup.remember("never-existed@example.com");
  table.rows[0].bc_delete_after = hoursAgo(1);
  brevo.behaviour = async () => ({ existed: false });
  summary = await cleanup.sweep();
  check(
    "404 counts as absent, not as a failure",
    summary.absent === 1 && summary.failed === 0,
    JSON.stringify(summary)
  );
  check("the row is still cleared", table.rows.length === 0);

  console.log("\nWhen Brevo will not answer\n");

  table.rows = [];
  await cleanup.remember("stuck@example.com");
  table.rows[0].bc_delete_after = hoursAgo(1);
  brevo.behaviour = async () => {
    throw new Error("Brevo is down");
  };

  summary = await cleanup.sweep();
  check("the failure is counted", summary.failed === 1, JSON.stringify(summary));
  check("the row is kept for another try", table.rows.length === 1);
  check("the attempt is recorded", table.rows[0].bc_attempts === 1);
  check(
    "and the reason is kept for whoever reads the table",
    /Brevo is down/.test(table.rows[0].bc_last_error || ""),
    table.rows[0].bc_last_error
  );

  for (let i = 0; i < 6; i += 1) await cleanup.sweep();
  check(
    "a permanently failing address is eventually left alone",
    table.rows[0].bc_attempts === cleanup.MAX_ATTEMPTS,
    String(table.rows[0].bc_attempts)
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((error) => {
  console.error("test run failed:", error);
  process.exit(1);
});
