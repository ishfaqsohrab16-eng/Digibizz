const { Op, fn, col } = require("sequelize");
const { sequelize } = require("../config/db");
const EmailCampaign = require("../models/emailCampaignModel");
const EmailCampaignRecipient = require("../models/emailCampaignRecipientModel");
const dispatcher = require("../utils/emailCampaignDispatcher");
const {
  parseRecipientList,
  buildTemplateCsv,
  MAX_ROWS,
} = require("../utils/recipientListParser");
const { STARTER_HTML } = require("../servec/campaignTemplates");
const { isConfigured, provider } = require("../servec/emailConfig");
const quota = require("../utils/emailQuota");
const { safeRollback } = require("../utils/safeRollback");

/**
 * Email campaigns: upload a list of addresses, write an email, send it slowly.
 *
 * This module is standalone. It used to be part of admissions - a campaign
 * belonged to a center and a batch, and its recipients were candidates or
 * enrolled students resolved out of those tables, with three different
 * built-in letter templates and merge tokens filled in per person. All of that
 * is gone. A campaign is now:
 *
 *   a name, a subject, one piece of HTML, and a list of email addresses.
 *
 * The HTML is static: every recipient receives byte-identical markup. There is
 * no token substitution, so there is nothing that can differ between two
 * recipients and nothing to preview "as seen by" any particular person - what
 * the compose screen shows IS what every address receives.
 *
 * Sending is paced rather than fired in one burst; see
 * utils/emailCampaignDispatcher.js for why and how.
 */

/** Deliberately permissive - the receiving server decides validity in the end. */
const looksLikeEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 150;

const EMPTY_STATS = { pending: 0, sent: 0, failed: 0, skipped: 0, total: 0 };

/**
 * Normalise a list of rows into the addresses that will actually be queued.
 *
 * Re-done here rather than trusted from the browser: the file was parsed in a
 * separate request, so the payload posted to create the campaign could have
 * been edited in between. Duplicates and malformed addresses are dropped
 * silently at this point because the upload step already reported them.
 */
const cleanRecipients = (rows) => {
  const seen = new Set();
  const cleaned = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    const email = String(row?.email || "").trim().toLowerCase();
    if (!email || !looksLikeEmail(email)) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    cleaned.push({
      email,
      // Kept for the recipient table and the CSV export so an operator can
      // recognise a row. It is NOT merged into the message.
      name: String(row?.name || "").trim().slice(0, 150) || null,
    });
  }

  return cleaned;
};

/** Per-campaign counts, used by both the list and the detail screen. */
const statsFor = async (campaignIds) => {
  if (!campaignIds.length) return {};

  const rows = await EmailCampaignRecipient.findAll({
    where: { ec_id: { [Op.in]: campaignIds } },
    attributes: ["ec_id", "ecr_status", [fn("COUNT", col("ecr_id")), "count"]],
    group: ["ec_id", "ecr_status"],
    raw: true,
  });

  return rows.reduce((acc, row) => {
    const id = Number(row.ec_id);
    if (!acc[id]) acc[id] = { ...EMPTY_STATS };
    acc[id][row.ecr_status] = Number(row.count) || 0;
    acc[id].total += Number(row.count) || 0;
    return acc;
  }, {});
};

// ---------------------------------------------------------------------------
// Compose helpers
// ---------------------------------------------------------------------------

/** Starter HTML for the compose editor. */
exports.getStarterTemplate = async (_req, res) => {
  return res.json({ success: true, html: STARTER_HTML });
};

/**
 * The spreadsheet operators fill in.
 *
 * One column, "Email". Nothing else is read, because nothing else is used -
 * the message is identical for every address.
 */
exports.downloadListTemplate = async (_req, res) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="email-list-template.csv"'
  );
  return res.send(buildTemplateCsv());
};

/**
 * Read an uploaded spreadsheet and report what it contains.
 *
 * Nothing is saved here. The parsed addresses go back to the browser, are
 * shown for confirmation, and are posted again when the campaign is created -
 * so an operator always sees exactly who is about to be mailed before anything
 * is written.
 */
exports.uploadRecipientList = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({
        success: false,
        message: "Choose a .xlsx or .csv file with an Email column.",
      });
    }

    const { recipients, skipped, total } = parseRecipientList(
      req.file.buffer,
      req.file.originalname
    );

    if (!recipients.length) {
      return res.status(400).json({
        success: false,
        message: "No usable email addresses in that file.",
        skipped,
      });
    }

    return res.json({
      success: true,
      total,
      accepted: recipients.length,
      // Only the address and an optional name survive; extra columns are not
      // used because the message is the same for everyone.
      recipients: recipients.map((r) => ({ email: r.email, name: r.name })),
      skipped,
      maxRows: MAX_ROWS,
    });
  } catch (error) {
    // parseRecipientList throws messages written for the operator - "no email
    // column", "no rows below the header" - so they are passed straight
    // through rather than replaced with a generic failure.
    return res.status(400).json({
      success: false,
      message: error.message || "Could not read that file.",
    });
  }
};

/**
 * Show the email exactly as it will be sent.
 *
 * With no merge tokens this is a straight echo of the author's HTML, which is
 * the point: there is no per-recipient variation that a preview could hide.
 */
exports.previewTemplate = async (req, res) => {
  try {
    const html = String(req.body?.ec_custom_html || "").trim();
    if (!html) {
      return res
        .status(400)
        .json({ success: false, message: "Write the email body first." });
    }

    return res.json({
      success: true,
      subject: String(req.body?.ec_subject || "").trim() || "(no subject)",
      html,
    });
  } catch (error) {
    console.error("Error previewing template:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

/** Create a campaign and freeze its recipient list. */
exports.createCampaign = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      ec_name,
      ec_subject,
      ec_custom_html,
      ec_batch_size,
      ec_interval_minutes,
      ec_min_gap_seconds,
      ec_max_gap_seconds,
      recipientList,
      startNow,
    } = req.body;

    if (!String(ec_name || "").trim()) {
      await safeRollback(transaction);
      return res
        .status(400)
        .json({ success: false, message: "Give the campaign a name." });
    }

    if (!String(ec_subject || "").trim()) {
      await safeRollback(transaction);
      return res
        .status(400)
        .json({ success: false, message: "Give the email a subject." });
    }

    if (!String(ec_custom_html || "").trim()) {
      await safeRollback(transaction);
      return res.status(400).json({
        success: false,
        message: "Write the email body before creating the campaign.",
      });
    }

    const recipients = cleanRecipients(recipientList);
    if (!recipients.length) {
      await safeRollback(transaction);
      return res.status(400).json({
        success: false,
        message: "Upload a list with at least one valid email address.",
      });
    }

    // Pacing. Clamped rather than rejected: a nonsensical value from the form
    // should slow the send down, never fail the whole campaign.
    const minGap = Math.max(0, Number(ec_min_gap_seconds) || 0);
    const maxGap = Math.max(minGap, Number(ec_max_gap_seconds) || minGap);
    const batchSize = Math.min(500, Math.max(1, Number(ec_batch_size) || 25));
    const intervalMinutes = Math.max(1, Number(ec_interval_minutes) || 15);

    const campaign = await EmailCampaign.create(
      {
        ec_name: String(ec_name).trim().slice(0, 150),
        ec_subject: String(ec_subject).trim().slice(0, 200),
        ec_custom_html,
        ec_target_count: recipients.length,
        ec_batch_size: batchSize,
        ec_interval_minutes: intervalMinutes,
        ec_min_gap_seconds: minGap,
        ec_max_gap_seconds: maxGap,
        // Due immediately when started; every later gap is jittered by the
        // dispatcher so chunks never land on a predictable rhythm.
        ec_next_run_at: startNow ? new Date() : null,
        ec_status: startNow ? "running" : "draft",
        ec_created_by: req.user?.user_id || null,
        // Legacy admissions columns. Explicitly NULL so it is obvious in the
        // data that this campaign was never scoped to a center or batch.
        tb_id: null,
        center_id: null,
        ec_kind: null,
        ec_audience: null,
      },
      { transaction }
    );

    await EmailCampaignRecipient.bulkCreate(
      recipients.map((r) => ({
        ec_id: campaign.ec_id,
        ecr_email: r.email,
        ecr_name: r.name,
        ecr_status: "pending",
      })),
      { transaction, ignoreDuplicates: true }
    );

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: startNow
        ? `Campaign created. ${recipients.length} email(s) queued and sending has started.`
        : `Campaign created as a draft with ${recipients.length} email(s) queued.`,
      campaign: campaign.toJSON(),
      queued: recipients.length,
    });
  } catch (error) {
    // Rolling back an already-finished transaction throws and would mask the
    // real error, so the state is checked first.
    if (!transaction.finished) await safeRollback(transaction);
    console.error("Error creating campaign:", error);
    return res.status(500).json({
      success: false,
      message: "Server error creating the campaign",
    });
  }
};

exports.listCampaigns = async (_req, res) => {
  try {
    const campaigns = await EmailCampaign.findAll({
      order: [["ec_id", "DESC"]],
    });

    const stats = await statsFor(campaigns.map((c) => c.ec_id));

    // The day's remaining allowance travels with the list because it is the
    // number that decides whether a campaign created now goes out today. On
    // Brevo's free plan a 500-address campaign is two days of sending, and an
    // operator who is not told that reads the pause as a fault.
    const allowance = await quota.describe();

    return res.json({
      success: true,
      campaigns: campaigns.map((campaign) => ({
        ...campaign.toJSON(),
        stats: stats[campaign.ec_id] || { ...EMPTY_STATS },
      })),
      allowance: {
        provider,
        ...allowance,
      },
    });
  } catch (error) {
    console.error("Error listing campaigns:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getCampaign = async (req, res) => {
  try {
    const campaign = await EmailCampaign.findByPk(req.params.id);

    if (!campaign) {
      return res
        .status(404)
        .json({ success: false, message: "Campaign not found" });
    }

    const stats = await statsFor([campaign.ec_id]);

    return res.json({
      success: true,
      campaign: campaign.toJSON(),
      stats: stats[campaign.ec_id] || { ...EMPTY_STATS },
    });
  } catch (error) {
    console.error("Error fetching campaign:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.listRecipients = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 50));

    const where = { ec_id: Number(req.params.id) };
    if (req.query.status) where.ecr_status = String(req.query.status);
    if (req.query.search) {
      where.ecr_email = { [Op.like]: `%${String(req.query.search).trim()}%` };
    }

    const { rows, count } = await EmailCampaignRecipient.findAndCountAll({
      where,
      // No joins: a list recipient is an address, with nothing behind it to
      // include. Including candidate/student here is what produced the
      // "associated to student using an alias" failure.
      attributes: [
        "ecr_id",
        "ecr_email",
        "ecr_name",
        "ecr_status",
        "ecr_sent_at",
        "ecr_attempts",
        "ecr_error",
      ],
      order: [["ecr_id", "ASC"]],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    return res.json({
      success: true,
      total: count,
      page,
      pageSize,
      recipients: rows,
    });
  } catch (error) {
    console.error("Error listing recipients:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/** RFC 4180 escaping: quote the field and double any quote inside it. */
const csvCell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Filename-safe slug, so a campaign name cannot break the download header. */
const slugify = (value) =>
  String(value || "campaign")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60) || "campaign";

exports.exportRecipients = async (req, res) => {
  try {
    const campaign = await EmailCampaign.findByPk(req.params.id);
    if (!campaign) {
      return res
        .status(404)
        .json({ success: false, message: "Campaign not found" });
    }

    const recipients = await EmailCampaignRecipient.findAll({
      where: { ec_id: campaign.ec_id },
      order: [["ecr_id", "ASC"]],
    });

    const header = ["Email", "Name", "Status", "Sent at", "Attempts", "Error"];
    const lines = [header.join(",")];

    for (const r of recipients) {
      lines.push(
        [
          csvCell(r.ecr_email),
          csvCell(r.ecr_name),
          csvCell(r.ecr_status),
          csvCell(r.ecr_sent_at ? new Date(r.ecr_sent_at).toISOString() : ""),
          csvCell(r.ecr_attempts),
          csvCell(r.ecr_error),
        ].join(",")
      );
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${slugify(campaign.ec_name)}-recipients.csv"`
    );
    // BOM so Excel opens it as UTF-8 rather than the system codepage.
    return res.send("﻿" + lines.join("\r\n") + "\r\n");
  } catch (error) {
    console.error("Error exporting recipients:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Send a proof copy to the configured test addresses.
 *
 * Uses the campaign's real subject and body, so what comes back is exactly
 * what the list will receive.
 */
exports.sendTest = async (req, res) => {
  try {
    if (!isConfigured) {
      return res.status(503).json({
        success: false,
        message: "SMTP is not configured, so no mail can be sent.",
      });
    }

    const campaign = await EmailCampaign.findByPk(req.params.id);
    if (!campaign) {
      return res
        .status(404)
        .json({ success: false, message: "Campaign not found" });
    }

    const result = await dispatcher.sendTestCopies(campaign);

    return res.json({
      success: true,
      message: result.sent.length
        ? `Test copy sent to ${result.sent.join(", ")}`
        : "No test recipients are configured.",
      ...result,
    });
  } catch (error) {
    console.error("Error sending test:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error sending the test copy" });
  }
};

/** start | pause | cancel */
exports.updateStatus = async (req, res) => {
  try {
    const action = String(req.params.action || "").toLowerCase();
    const campaign = await EmailCampaign.findByPk(req.params.id);

    if (!campaign) {
      return res
        .status(404)
        .json({ success: false, message: "Campaign not found" });
    }

    if (campaign.ec_status === "completed" && action !== "cancel") {
      return res.status(400).json({
        success: false,
        message: "That campaign has already finished.",
      });
    }

    if (campaign.ec_status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "That campaign was cancelled and cannot be restarted.",
      });
    }

    switch (action) {
      case "start":
        // Due immediately. Every later chunk is jittered from here.
        await campaign.update({
          ec_status: "running",
          ec_next_run_at: new Date(),
        });
        break;
      case "pause":
        // ec_next_run_at is left alone so resuming does not lose the place in
        // the schedule and fire a chunk early.
        await campaign.update({ ec_status: "paused" });
        break;
      case "cancel":
        await campaign.update({ ec_status: "cancelled" });
        break;
      default:
        return res.status(400).json({
          success: false,
          message: "Unknown action. Use start, pause or cancel.",
        });
    }

    return res.json({
      success: true,
      message: `Campaign ${action}${action === "stop" ? "ped" : action.endsWith("e") ? "d" : "ed"}.`,
      campaign: campaign.toJSON(),
    });
  } catch (error) {
    console.error("Error updating campaign status:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Release one chunk right now, without waiting for the next tick.
 *
 * Claimed through the dispatcher so a manual push and the scheduler can never
 * send the same chunk twice.
 */
exports.sendNow = async (req, res) => {
  try {
    if (!isConfigured) {
      return res.status(503).json({
        success: false,
        message: "SMTP is not configured, so no mail can be sent.",
      });
    }

    const campaign = await EmailCampaign.findByPk(req.params.id);
    if (!campaign) {
      return res
        .status(404)
        .json({ success: false, message: "Campaign not found" });
    }

    if (campaign.ec_status === "cancelled" || campaign.ec_status === "completed") {
      return res.status(400).json({
        success: false,
        message: `That campaign is ${campaign.ec_status}.`,
      });
    }

    if (!dispatcher.claim(campaign.ec_id)) {
      return res.status(409).json({
        success: false,
        message: "A chunk of this campaign is already going out.",
      });
    }

    try {
      const sent = await dispatcher.sendChunk(campaign);
      const finishedAt = new Date();

      const remaining = await EmailCampaignRecipient.count({
        where: { ec_id: campaign.ec_id, ecr_status: "pending" },
      });

      await campaign.update({
        ec_last_run_at: finishedAt,
        ec_status: remaining === 0 ? "completed" : campaign.ec_status,
        ec_next_run_at:
          remaining === 0
            ? null
            : dispatcher.computeNextRunAt(campaign, finishedAt),
      });

      return res.json({
        success: true,
        message: `Sent ${sent} email(s). ${remaining} still queued.`,
        sent,
        remaining,
      });
    } finally {
      // Released even if the send threw, otherwise the campaign would be
      // permanently stuck as "in flight" and never picked up again.
      dispatcher.release(campaign.ec_id);
    }
  } catch (error) {
    console.error("Error sending now:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error sending the chunk" });
  }
};

/**
 * Delete a campaign and its recipient rows.
 *
 * Refused while a campaign is running: deleting rows out from under the
 * dispatcher mid-chunk would leave it sending to records that no longer exist.
 * Pause or cancel first, which is also a moment to reconsider.
 */
exports.deleteCampaign = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const campaign = await EmailCampaign.findByPk(req.params.id);

    if (!campaign) {
      await safeRollback(transaction);
      return res
        .status(404)
        .json({ success: false, message: "Campaign not found" });
    }

    if (campaign.ec_status === "running") {
      await safeRollback(transaction);
      return res.status(400).json({
        success: false,
        message: "Pause or cancel the campaign before deleting it.",
      });
    }

    await EmailCampaignRecipient.destroy({
      where: { ec_id: campaign.ec_id },
      transaction,
    });
    await campaign.destroy({ transaction });
    await transaction.commit();

    return res.json({ success: true, message: "Campaign deleted." });
  } catch (error) {
    if (!transaction.finished) await safeRollback(transaction);
    console.error("Error deleting campaign:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
