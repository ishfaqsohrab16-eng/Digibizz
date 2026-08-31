const EmailSendQuota = require("../models/emailSendQuotaModel");

/**
 * The day's sending allowance, and who is allowed to spend it.
 *
 * Brevo's free plan is 300 emails a day across everything. Campaigns and
 * registration codes therefore compete, and campaigns win by sheer volume: a
 * few hundred addresses would take the whole allowance in one run and leave
 * every applicant that afternoon unable to confirm their email.
 *
 * So a slice of the day is reserved. Campaigns may spend down to the reserve
 * and no further; transactional mail may spend everything, because a person is
 * waiting on it and there is no later. In practice that turns a 500-address
 * campaign into two days of sending, which is what the free plan means.
 *
 * Everything here is advisory. Brevo enforces the real limit, and a failure to
 * read or write the counter must never stop an email going out - so every
 * database call is wrapped, and the fail-open answer is the permissive one.
 */

/** Brevo free plan. Raise it here when the plan is upgraded. */
const DAILY_LIMIT = Number(process.env.BREVO_DAILY_LIMIT) || 300;

/**
 * Held back for mail a person is waiting on.
 *
 * Sized for a day's registrations rather than a guess: 50 codes is a busy
 * admissions day, and it costs a campaign one extra day at most.
 */
const TRANSACTIONAL_RESERVE =
  Number(process.env.BREVO_TRANSACTIONAL_RESERVE) || 50;

/** "Today" as the people running the program experience it. */
const TIMEZONE = process.env.EMAIL_QUOTA_TIMEZONE || "Asia/Karachi";

/** YYYY-MM-DD in TIMEZONE. en-CA formats dates that way by default. */
const todayKey = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

const EMPTY = { total: 0, transactional: 0, campaign: 0 };

/**
 * Today's row, created if this is the day's first send.
 *
 * Returns null rather than throwing: the counter is a convenience, and a
 * database hiccup must not become an email outage.
 */
const todayRow = async () => {
  try {
    const [row] = await EmailSendQuota.findOrCreate({
      where: { esq_date: todayKey() },
      defaults: { esq_date: todayKey(), ...EMPTY },
    });
    return row;
  } catch (error) {
    console.error("[quota] could not read today's row:", error?.message || error);
    return null;
  }
};

/** What has been sent today. Zeroes if the counter is unavailable. */
const usageToday = async () => {
  const row = await todayRow();
  if (!row) return { date: todayKey(), ...EMPTY, available: false };

  return {
    date: row.esq_date,
    total: row.esq_total,
    transactional: row.esq_transactional,
    campaign: row.esq_campaign,
    available: true,
  };
};

/**
 * Count one sent message.
 *
 * `increment` rather than read-modify-write: two campaigns draining at once
 * would otherwise each read the same number and write it back, losing sends
 * from the count and overshooting the day's limit.
 */
const record = async (kind = "campaign") => {
  const row = await todayRow();
  if (!row) return;

  const column = kind === "transactional" ? "esq_transactional" : "esq_campaign";
  try {
    await row.increment(["esq_total", column]);
  } catch (error) {
    console.error("[quota] could not record a send:", error?.message || error);
  }
};

/**
 * How many more campaign emails may go out today.
 *
 * Fails open (returns the full budget) when the counter cannot be read - the
 * alternative is refusing to send because a table is missing, which turns a
 * reporting problem into an outage. Brevo still enforces the real limit.
 */
const campaignBudget = async () => {
  const usage = await usageToday();
  if (!usage.available) return Math.max(0, DAILY_LIMIT - TRANSACTIONAL_RESERVE);
  return Math.max(0, DAILY_LIMIT - TRANSACTIONAL_RESERVE - usage.total);
};

/**
 * Whether mail a person is waiting on may still go out.
 *
 * Transactional mail may spend the reserve and everything else: refusing an
 * applicant their code to protect a campaign would have the priorities exactly
 * backwards.
 */
const transactionalAllowed = async () => {
  const usage = await usageToday();
  if (!usage.available) return true;
  return usage.total < DAILY_LIMIT;
};

/** One line for the logs and the campaign screen. */
const describe = async () => {
  const usage = await usageToday();
  const forCampaigns = Math.max(
    0,
    DAILY_LIMIT - TRANSACTIONAL_RESERVE - usage.total
  );
  return {
    ...usage,
    dailyLimit: DAILY_LIMIT,
    reserve: TRANSACTIONAL_RESERVE,
    remainingForCampaigns: forCampaigns,
    remainingTotal: Math.max(0, DAILY_LIMIT - usage.total),
  };
};

module.exports = {
  todayKey,
  usageToday,
  record,
  campaignBudget,
  transactionalAllowed,
  describe,
  DAILY_LIMIT,
  TRANSACTIONAL_RESERVE,
  TIMEZONE,
};
