/**
 * Regression tests for the daily sending allowance.
 *
 * Run with:  node utils/emailQuota.test.js
 * Exits non-zero if any rule regresses. No database.
 *
 * Brevo's free plan is 300 emails a day across everything, so campaigns and
 * registration codes compete for one pot and campaigns win on volume alone.
 * The rules that matter:
 *
 *   - campaigns may spend down to the reserve and no further,
 *   - transactional mail may spend everything, because a person is waiting and
 *     there is no later,
 *   - and none of this may ever stop an email when the counter itself is broken.
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

// Read at module load, so they must be set before the require below.
process.env.BREVO_DAILY_LIMIT = "300";
process.env.BREVO_TRANSACTIONAL_RESERVE = "50";
process.env.EMAIL_QUOTA_TIMEZONE = "Asia/Karachi";

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

/** One in-memory row, with the slice of Sequelize the counter actually uses. */
const store = { row: null, broken: false };

const makeRow = (values) => ({
  ...values,
  async increment(columns) {
    for (const column of columns) this[column] += 1;
    return this;
  },
});

stub("../models/emailSendQuotaModel", {
  async findOrCreate({ defaults }) {
    if (store.broken) throw new Error("database is down");
    if (!store.row) store.row = makeRow(defaults);
    return [store.row, false];
  },
});

const quota = require("./emailQuota");

const reset = (values = {}) => {
  store.broken = false;
  store.row = makeRow({
    esq_date: quota.todayKey(),
    esq_total: 0,
    esq_transactional: 0,
    esq_campaign: 0,
    ...values,
  });
};

(async () => {
  console.log("\nToday's date key\n");

  const key = quota.todayKey(new Date("2026-08-31T20:00:00Z"));
  // 20:00 UTC is already the 1st in Karachi (+05:00). Counting in UTC would put
  // those sends on the wrong day and hand out a second allowance at 05:00.
  check("the day is the program's day, not UTC's", key === "2026-09-01", key);
  check(
    "the format is what the column stores",
    /^\d{4}-\d{2}-\d{2}$/.test(quota.todayKey()),
    quota.todayKey()
  );

  console.log("\nSpending the allowance\n");

  reset();
  check(
    "a fresh day gives campaigns everything but the reserve",
    (await quota.campaignBudget()) === 250,
    String(await quota.campaignBudget())
  );

  reset({ esq_total: 100, esq_campaign: 100 });
  check(
    "campaign sends come off the budget",
    (await quota.campaignBudget()) === 150,
    String(await quota.campaignBudget())
  );

  // The reserve protects codes from campaigns, not campaigns from codes: a busy
  // registration day legitimately squeezes what is left for a campaign.
  reset({ esq_total: 100, esq_transactional: 100 });
  check(
    "registration codes come off it too",
    (await quota.campaignBudget()) === 150,
    String(await quota.campaignBudget())
  );

  reset({ esq_total: 250, esq_campaign: 250 });
  check(
    "campaigns stop at the reserve, with the day's limit not yet reached",
    (await quota.campaignBudget()) === 0,
    String(await quota.campaignBudget())
  );
  check(
    "and codes can still go out - that is what the reserve is for",
    (await quota.transactionalAllowed()) === true
  );

  reset({ esq_total: 300, esq_transactional: 300 });
  check(
    "nothing goes out once the day's limit is truly reached",
    (await quota.transactionalAllowed()) === false
  );

  reset({ esq_total: 400 });
  check(
    "an overspent day reports no budget rather than a negative one",
    (await quota.campaignBudget()) === 0,
    String(await quota.campaignBudget())
  );

  console.log("\nCounting\n");

  reset();
  await quota.record("transactional");
  await quota.record("campaign");
  await quota.record();
  check(
    "each send moves the total and its own column",
    store.row.esq_total === 3 &&
      store.row.esq_transactional === 1 &&
      store.row.esq_campaign === 2,
    JSON.stringify(store.row)
  );

  console.log("\nWhen the counter itself is broken\n");

  // The counter is a convenience. Refusing to send because a table is missing
  // would turn a reporting problem into an email outage.
  store.broken = true;
  check(
    "campaigns still get a budget",
    (await quota.campaignBudget()) === 250,
    String(await quota.campaignBudget())
  );
  check("codes are still allowed", (await quota.transactionalAllowed()) === true);

  let threw = null;
  try {
    await quota.record("campaign");
  } catch (error) {
    threw = error;
  }
  check("recording a send does not throw", threw === null, String(threw));

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((error) => {
  console.error("test run failed:", error);
  process.exit(1);
});
