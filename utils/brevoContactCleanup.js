const { Op } = require("sequelize");
const BrevoContact = require("../models/brevoContactModel");
const { deleteContact, isBrevoConfigured } = require("../servec/providers/brevo");

/**
 * Removes from the Brevo account every address this application mailed, a day
 * after mailing it.
 *
 * Brevo's transactional endpoint is documented as not creating contacts, so
 * most of these deletes are expected to come back 404 - "there was nothing
 * there", which is the outcome we wanted anyway. The job is written to treat
 * that as success and to say plainly in its log how many contacts actually
 * existed, so the question "does Brevo keep our applicants?" is answered by
 * observation rather than by reading the documentation again.
 *
 * Deliberately driven from a local table rather than from Brevo's contact list.
 * "Delete every contact older than a day" would also delete contacts somebody
 * added on purpose; this only ever touches addresses this application sent to.
 *
 * Set BREVO_DELETE_CONTACTS=false to switch the whole thing off.
 */

/** Hours between the last message to an address and its contact being removed. */
const TTL_HOURS = Number(process.env.BREVO_CONTACT_TTL_HOURS) || 24;

/** How often to look for addresses that have come due. */
const SWEEP_INTERVAL_MS =
  Number(process.env.BREVO_CONTACT_SWEEP_MINUTES || 30) * 60 * 1000;

/**
 * Deletes per sweep.
 *
 * A day's sending on the free plan is 300 addresses, so one sweep clears a
 * whole day with room to spare. The cap exists so a backlog after an outage
 * drains steadily instead of firing thousands of requests at once.
 */
const MAX_PER_SWEEP = 200;

/** Give up on an address after this many failures and stop retrying it. */
const MAX_ATTEMPTS = 5;

const ENABLED =
  String(process.env.BREVO_DELETE_CONTACTS || "true").toLowerCase() !== "false";

let timer = null;
let sweeping = false;

/**
 * Note that an address was mailed, so its contact can be removed later.
 *
 * Best-effort by design: this is called on the success path of every send, and
 * a failure to write a cleanup note must never turn a delivered email into an
 * error. It logs and moves on.
 */
const remember = async (email) => {
  if (!ENABLED || !isBrevoConfigured) return;

  const address = String(email || "").trim().toLowerCase();
  if (!address) return;

  const deleteAfter = new Date(Date.now() + TTL_HOURS * 3600 * 1000);

  try {
    const [row, created] = await BrevoContact.findOrCreate({
      where: { bc_email: address },
      defaults: { bc_email: address, bc_delete_after: deleteAfter },
    });

    if (!created) {
      // Push the deadline out and clear the failure history: this is a fresh
      // send, not a continuation of whatever went wrong last time.
      await row.update({
        bc_delete_after: deleteAfter,
        bc_attempts: 0,
        bc_last_error: null,
      });
    }
  } catch (error) {
    console.error(
      "[brevo cleanup] could not record an address for cleanup:",
      error?.message || error
    );
  }
};

/**
 * Delete everything that has come due.
 *
 * Returns a summary so the caller - and the tests - can see what happened
 * rather than having to read the log.
 */
const sweep = async () => {
  if (!ENABLED || !isBrevoConfigured) {
    return { checked: 0, existed: 0, absent: 0, failed: 0, skipped: true };
  }

  // A sweep can outlast its own interval when Brevo is slow. Overlapping runs
  // would issue the same deletes twice and race on the same rows.
  if (sweeping) return { checked: 0, existed: 0, absent: 0, failed: 0, busy: true };
  sweeping = true;

  const summary = { checked: 0, existed: 0, absent: 0, failed: 0 };

  try {
    const due = await BrevoContact.findAll({
      where: {
        bc_delete_after: { [Op.lte]: new Date() },
        bc_attempts: { [Op.lt]: MAX_ATTEMPTS },
      },
      order: [["bc_delete_after", "ASC"]],
      limit: MAX_PER_SWEEP,
    });

    for (const row of due) {
      summary.checked += 1;
      try {
        const { existed } = await deleteContact(row.bc_email);
        if (existed) summary.existed += 1;
        else summary.absent += 1;

        // The row is the address. Once it has been dealt with, holding on to it
        // would rebuild the very list this job exists to prevent.
        await row.destroy();
      } catch (error) {
        summary.failed += 1;
        const attempts = row.bc_attempts + 1;
        await row.update({
          bc_attempts: attempts,
          bc_last_error: String(error?.message || error).slice(0, 255),
        });

        if (attempts >= MAX_ATTEMPTS) {
          console.error(
            `[brevo cleanup] giving up on ${row.bc_email} after ${attempts} attempts:`,
            error?.message || error
          );
        }
      }
    }

    if (summary.checked > 0) {
      console.log(
        `[brevo cleanup] checked ${summary.checked} address(es):`,
        `${summary.existed} contact(s) deleted,`,
        `${summary.absent} had no contact,`,
        `${summary.failed} failed`
      );
    }
  } catch (error) {
    console.error("[brevo cleanup] sweep failed:", error?.message || error);
  } finally {
    sweeping = false;
  }

  return summary;
};

const start = () => {
  if (timer) return;

  if (!ENABLED) {
    console.log("[brevo cleanup] disabled (BREVO_DELETE_CONTACTS=false)");
    return;
  }
  if (!isBrevoConfigured) return;

  timer = setInterval(() => {
    sweep().catch((error) =>
      console.error("[brevo cleanup] unhandled:", error?.message || error)
    );
  }, SWEEP_INTERVAL_MS);

  // The timer alone should never hold the process open at shutdown.
  if (typeof timer.unref === "function") timer.unref();

  console.log(
    `[brevo cleanup] started: contacts removed ${TTL_HOURS}h after the last message,`,
    `swept every ${Math.round(SWEEP_INTERVAL_MS / 60000)} minute(s)`
  );
};

const stop = () => {
  if (timer) clearInterval(timer);
  timer = null;
};

module.exports = {
  remember,
  sweep,
  start,
  stop,
  TTL_HOURS,
  MAX_ATTEMPTS,
  MAX_PER_SWEEP,
  ENABLED,
};
