const { Op, fn, col, literal } = require("sequelize");
const db = require("../config/db");
const sequelize = db.sequelize;
const EmailCampaign = require("../models/emailCampaignModel");
const EmailCampaignRecipient = require("../models/emailCampaignRecipientModel");
const Candidate = require("../models/CandidateModel");
const Course = require("../models/course");
const Center = require("../models/center");
const TrainingBatch = require("../models/trainingBatcheModel");
const { interviewCall } = require("../servec/campaignTemplates");
const dispatcher = require("../utils/emailCampaignDispatcher");
const { allocateEvenly } = require("../utils/allocateEvenly");

/**
 * Email campaigns for candidate outreach.
 *
 * The workflow this supports: pick a center, say how many candidates to
 * contact, and the quota is split evenly across that center's courses. A
 * later campaign for the same center automatically skips everyone already
 * contacted, so "200 now, 200 tomorrow, then 100" needs no manual bookkeeping.
 * A reminder campaign re-targets one earlier campaign's recipients, but only
 * those who still have not been interviewed.
 */

/**
 * A candidate counts as interviewed once marks or an interview date exist, so
 * "not interviewed" means neither is set. `TBD` is the placeholder the
 * interview portal writes, not a real mark, so it must not count as done.
 */
const NOT_INTERVIEWED = {
  [Op.and]: [
    {
      [Op.or]: [
        { cand_interview_marks: null },
        { cand_interview_marks: "" },
        { cand_interview_marks: "TBD" },
      ],
    },
    {
      [Op.or]: [{ interview_date: null }, { interview_date: "" }],
    },
  ],
};

/**
 * Candidate ids that must not be picked up by a new campaign for this
 * center+batch. This ledger is what makes "now send the next 200" work.
 *
 * Two separate rules, because cancelling a campaign has to free people up
 * without un-sending real email:
 *
 *   - Anyone actually SENT to is excluded forever, even if their campaign was
 *     later cancelled. Cancelling cannot retract a delivered message, and
 *     re-mailing them would be a duplicate.
 *   - Anyone still queued (pending/failed) is excluded only while their
 *     campaign is live. Cancel it and they return to the available pool,
 *     which is the point of cancelling.
 */
const alreadyContactedIds = async (tb_id, center_id, { excludeCampaignId } = {}) => {
  const campaignWhere = { tb_id, center_id };
  if (excludeCampaignId) campaignWhere.ec_id = { [Op.ne]: excludeCampaignId };

  const campaigns = await EmailCampaign.findAll({
    where: campaignWhere,
    attributes: ["ec_id", "ec_status"],
    raw: true,
  });

  if (campaigns.length === 0) return [];

  const allIds = campaigns.map((c) => c.ec_id);
  const liveIds = campaigns
    .filter((c) => c.ec_status !== "cancelled")
    .map((c) => c.ec_id);

  const rows = await EmailCampaignRecipient.findAll({
    where: {
      [Op.or]: [
        { ec_id: { [Op.in]: allIds }, ecr_status: "sent" },
        ...(liveIds.length
          ? [
              {
                ec_id: { [Op.in]: liveIds },
                ecr_status: { [Op.in]: ["pending", "failed"] },
              },
            ]
          : []),
      ],
    },
    attributes: [[fn("DISTINCT", col("cand_id")), "cand_id"]],
    raw: true,
  });

  return rows.map((row) => Number(row.cand_id));
};

/**
 * How many candidates a new campaign could reach right now, per course.
 * Drives the "available" figures on the create screen.
 */
exports.getEligibility = async (req, res) => {
  try {
    const tb_id = Number(req.query.tb_id);
    const center_id = Number(req.query.center_id);

    if (!tb_id || !center_id) {
      return res
        .status(400)
        .json({ success: false, message: "tb_id and center_id are required" });
    }

    const contacted = await alreadyContactedIds(tb_id, center_id);

    const where = {
      tb_id,
      center_id,
      cand_email: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] },
    };
    if (contacted.length > 0) where.cand_id = { [Op.notIn]: contacted };

    const rows = await Candidate.findAll({
      where,
      attributes: [
        "course_id",
        [fn("COUNT", col("Candidate.cand_id")), "available"],
      ],
      include: [
        {
          model: Course,
          as: "courses",
          attributes: ["course_name", "course_full_name"],
        },
      ],
      group: ["Candidate.course_id", "courses.course_id"],
      raw: true,
      nest: true,
    });

    const courses = rows.map((row) => ({
      course_id: Number(row.course_id),
      course_name: row.courses?.course_name || "",
      course_full_name: row.courses?.course_full_name || row.courses?.course_name || "",
      available: Number(row.available) || 0,
    }));

    return res.json({
      success: true,
      alreadyContacted: contacted.length,
      totalAvailable: courses.reduce((sum, c) => sum + c.available, 0),
      courses,
    });
  } catch (error) {
    console.error("Error computing campaign eligibility:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/** Create a campaign and freeze its recipient list. */
exports.createCampaign = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      ec_name,
      tb_id,
      center_id,
      ec_target_count,
      ec_batch_size,
      ec_interval_minutes,
      ec_min_gap_seconds,
      ec_max_gap_seconds,
      ec_subject,
      ec_interview_date,
      ec_interview_time,
      ec_reporting_time,
      ec_venue,
      ec_contact_person,
      ec_contact_phone,
      ec_message,
      startNow,
    } = req.body;

    if (!ec_name || !tb_id || !center_id) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Name, batch and center are required",
      });
    }

    const target = Math.max(0, Number(ec_target_count) || 0);
    if (target === 0) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "Number of emails must be at least 1" });
    }

    const minGap = Math.max(0, Number(ec_min_gap_seconds) || 0);
    const maxGap = Math.max(minGap, Number(ec_max_gap_seconds) || minGap);

    const contacted = await alreadyContactedIds(Number(tb_id), Number(center_id));

    const where = {
      tb_id: Number(tb_id),
      center_id: Number(center_id),
      cand_email: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] },
    };
    if (contacted.length > 0) where.cand_id = { [Op.notIn]: contacted };

    const candidates = await Candidate.findAll({
      where,
      attributes: ["cand_id", "cand_name", "cand_email", "course_id"],
      order: [["cand_id", "ASC"]],
      raw: true,
    });

    if (candidates.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          "Every candidate at this center has already been contacted for this batch.",
      });
    }

    // Group by course, then split the requested total evenly across them.
    const byCourse = new Map();
    for (const candidate of candidates) {
      const key = Number(candidate.course_id);
      if (!byCourse.has(key)) byCourse.set(key, []);
      byCourse.get(key).push(candidate);
    }

    const allocation = allocateEvenly(
      target,
      [...byCourse.entries()].map(([key, list]) => ({
        key,
        available: list.length,
      }))
    );

    const chosen = [];
    for (const [courseId, list] of byCourse.entries()) {
      chosen.push(...list.slice(0, allocation.get(courseId) || 0));
    }

    if (chosen.length === 0) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ success: false, message: "No candidates matched this campaign" });
    }

    const campaign = await EmailCampaign.create(
      {
        ec_name,
        tb_id: Number(tb_id),
        center_id: Number(center_id),
        ec_kind: "initial",
        ec_target_count: chosen.length,
        ec_batch_size: Math.max(1, Number(ec_batch_size) || 25),
        ec_interval_minutes: Math.max(1, Number(ec_interval_minutes) || 15),
        ec_min_gap_seconds: minGap,
        ec_max_gap_seconds: maxGap,
        ec_subject: ec_subject || "Interview call | Digibizz Program",
        ec_interview_date: ec_interview_date || null,
        ec_interview_time: ec_interview_time || null,
        ec_reporting_time: ec_reporting_time || null,
        ec_venue: ec_venue || null,
        ec_contact_person: ec_contact_person || null,
        ec_contact_phone: ec_contact_phone || null,
        ec_message: ec_message || null,
        ec_status: startNow ? "running" : "draft",
        // Due immediately when started; the dispatcher jitters every gap after
        // the first chunk.
        ec_next_run_at: startNow ? new Date() : null,
        ec_created_by: req.user?.id || req.user?.user_id || null,
      },
      { transaction }
    );

    await EmailCampaignRecipient.bulkCreate(
      chosen.map((candidate) => ({
        ec_id: campaign.ec_id,
        cand_id: candidate.cand_id,
        ecr_email: candidate.cand_email,
        ecr_name: candidate.cand_name,
        course_id: candidate.course_id,
        ecr_status: "pending",
      })),
      { transaction }
    );

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: `Campaign created for ${chosen.length} candidate(s)`,
      campaign,
      allocation: [...allocation.entries()].map(([course_id, count]) => ({
        course_id,
        count,
      })),
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error creating campaign:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Create a reminder campaign from an existing one.
 *
 * Targets only recipients the source campaign actually delivered to and who
 * still have no interview recorded - chasing someone who already attended is
 * exactly the kind of message that gets a sender reported as spam.
 */
exports.createReminder = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const source = await EmailCampaign.findByPk(req.params.id);
    if (!source) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }

    const sentRecipients = await EmailCampaignRecipient.findAll({
      where: { ec_id: source.ec_id, ecr_status: "sent" },
      attributes: ["cand_id", "ecr_email", "ecr_name", "course_id"],
      raw: true,
    });

    if (sentRecipients.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "This campaign has not delivered any emails yet",
      });
    }

    const stillWaiting = await Candidate.findAll({
      where: {
        cand_id: { [Op.in]: sentRecipients.map((r) => r.cand_id) },
        ...NOT_INTERVIEWED,
      },
      attributes: ["cand_id"],
      raw: true,
    });

    const waitingIds = new Set(stillWaiting.map((row) => Number(row.cand_id)));
    const chosen = sentRecipients.filter((row) => waitingIds.has(Number(row.cand_id)));

    if (chosen.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Everyone in this campaign has already been interviewed",
      });
    }

    const {
      ec_name,
      ec_subject,
      ec_interview_date,
      ec_interview_time,
      ec_reporting_time,
      ec_venue,
      ec_contact_person,
      ec_contact_phone,
      ec_message,
      ec_batch_size,
      ec_interval_minutes,
      ec_min_gap_seconds,
      ec_max_gap_seconds,
      startNow,
    } = req.body || {};

    const minGap =
      ec_min_gap_seconds === undefined
        ? source.ec_min_gap_seconds
        : Math.max(0, Number(ec_min_gap_seconds) || 0);
    const maxGap =
      ec_max_gap_seconds === undefined
        ? source.ec_max_gap_seconds
        : Math.max(minGap, Number(ec_max_gap_seconds) || minGap);

    const campaign = await EmailCampaign.create(
      {
        ec_name: ec_name || `Reminder - ${source.ec_name}`,
        tb_id: source.tb_id,
        center_id: source.center_id,
        ec_kind: "reminder",
        ec_source_campaign_id: source.ec_id,
        ec_target_count: chosen.length,
        ec_batch_size: Math.max(1, Number(ec_batch_size) || source.ec_batch_size),
        ec_interval_minutes: Math.max(
          1,
          Number(ec_interval_minutes) || source.ec_interval_minutes
        ),
        ec_min_gap_seconds: minGap,
        ec_max_gap_seconds: maxGap,
        ec_subject: ec_subject || `Reminder: ${source.ec_subject}`,
        ec_interview_date: ec_interview_date ?? source.ec_interview_date,
        ec_interview_time: ec_interview_time ?? source.ec_interview_time,
        ec_reporting_time: ec_reporting_time ?? source.ec_reporting_time,
        ec_venue: ec_venue ?? source.ec_venue,
        ec_contact_person: ec_contact_person ?? source.ec_contact_person,
        ec_contact_phone: ec_contact_phone ?? source.ec_contact_phone,
        ec_message: ec_message ?? source.ec_message,
        ec_status: startNow ? "running" : "draft",
        ec_next_run_at: startNow ? new Date() : null,
        ec_created_by: req.user?.id || req.user?.user_id || null,
      },
      { transaction }
    );

    await EmailCampaignRecipient.bulkCreate(
      chosen.map((row) => ({
        ec_id: campaign.ec_id,
        cand_id: row.cand_id,
        ecr_email: row.ecr_email,
        ecr_name: row.ecr_name,
        course_id: row.course_id,
        ecr_status: "pending",
      })),
      { transaction }
    );

    await transaction.commit();

    return res.status(201).json({
      success: true,
      message: `Reminder created for ${chosen.length} candidate(s) who have not been interviewed`,
      campaign,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error creating reminder campaign:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/** Per-campaign counts, used by both the list and the detail screen. */
const statsFor = async (campaignIds) => {
  if (campaignIds.length === 0) return {};

  const rows = await EmailCampaignRecipient.findAll({
    where: { ec_id: { [Op.in]: campaignIds } },
    attributes: [
      "ec_id",
      "ecr_status",
      [fn("COUNT", col("ecr_id")), "count"],
    ],
    group: ["ec_id", "ecr_status"],
    raw: true,
  });

  return rows.reduce((acc, row) => {
    const id = Number(row.ec_id);
    if (!acc[id]) acc[id] = { pending: 0, sent: 0, failed: 0, skipped: 0, total: 0 };
    acc[id][row.ecr_status] = Number(row.count) || 0;
    acc[id].total += Number(row.count) || 0;
    return acc;
  }, {});
};

exports.listCampaigns = async (req, res) => {
  try {
    const where = {};
    if (req.query.tb_id) where.tb_id = Number(req.query.tb_id);
    if (req.query.center_id) where.center_id = Number(req.query.center_id);

    const campaigns = await EmailCampaign.findAll({
      where,
      include: [
        { model: Center, as: "center", attributes: ["center_id", "center_name"] },
        { model: TrainingBatch, as: "batch", attributes: ["tb_id", "tb_name"] },
      ],
      order: [["ec_id", "DESC"]],
    });

    const stats = await statsFor(campaigns.map((c) => c.ec_id));

    return res.json({
      success: true,
      campaigns: campaigns.map((campaign) => ({
        ...campaign.toJSON(),
        stats: stats[campaign.ec_id] || {
          pending: 0,
          sent: 0,
          failed: 0,
          skipped: 0,
          total: 0,
        },
      })),
    });
  } catch (error) {
    console.error("Error listing campaigns:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getCampaign = async (req, res) => {
  try {
    const campaign = await EmailCampaign.findByPk(req.params.id, {
      include: [
        { model: Center, as: "center", attributes: ["center_id", "center_name"] },
        { model: TrainingBatch, as: "batch", attributes: ["tb_id", "tb_name"] },
      ],
    });

    if (!campaign) {
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }

    const stats = await statsFor([campaign.ec_id]);

    // Per-course split, so the operator can confirm the quota really was
    // divided evenly rather than trusting the create screen.
    const perCourse = await EmailCampaignRecipient.findAll({
      where: { ec_id: campaign.ec_id },
      attributes: [
        "course_id",
        [fn("COUNT", col("ecr_id")), "total"],
        [
          fn("SUM", literal("CASE WHEN ecr_status = 'sent' THEN 1 ELSE 0 END")),
          "sent",
        ],
      ],
      include: [
        {
          model: Course,
          as: "course",
          attributes: ["course_name", "course_full_name"],
        },
      ],
      group: ["EmailCampaignRecipient.course_id", "course.course_id"],
      raw: true,
      nest: true,
    });

    return res.json({
      success: true,
      campaign: campaign.toJSON(),
      stats: stats[campaign.ec_id] || {
        pending: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        total: 0,
      },
      perCourse: perCourse.map((row) => ({
        course_id: Number(row.course_id),
        course_name:
          row.course?.course_full_name || row.course?.course_name || "Unknown",
        total: Number(row.total) || 0,
        sent: Number(row.sent) || 0,
      })),
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

    const { rows, count } = await EmailCampaignRecipient.findAndCountAll({
      where,
      include: [
        {
          model: Candidate,
          as: "candidate",
          attributes: ["cand_id", "cand_cnic", "cand_phone", "cand_interview_marks", "interview_date"],
        },
        {
          model: Course,
          as: "course",
          attributes: ["course_name", "course_full_name"],
        },
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

/** start | pause | cancel */
exports.updateStatus = async (req, res) => {
  try {
    const action = String(req.params.action || "").toLowerCase();
    const campaign = await EmailCampaign.findByPk(req.params.id);

    if (!campaign) {
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }

    if (campaign.ec_status === "completed" && action !== "cancel") {
      return res
        .status(400)
        .json({ success: false, message: "This campaign has already finished" });
    }

    if (action === "start") {
      await campaign.update({
        ec_status: "running",
        // Due immediately; every later gap is jittered by the dispatcher.
        ec_next_run_at: new Date(),
      });
    } else if (action === "pause") {
      await campaign.update({ ec_status: "paused", ec_next_run_at: null });
    } else if (action === "cancel") {
      await campaign.update({ ec_status: "cancelled", ec_next_run_at: null });
      // Anything unsent is dropped rather than left looking merely pending.
      await EmailCampaignRecipient.update(
        { ecr_status: "skipped" },
        { where: { ec_id: campaign.ec_id, ecr_status: "pending" } }
      );
    } else {
      return res.status(400).json({ success: false, message: "Unknown action" });
    }

    return res.json({ success: true, campaign });
  } catch (error) {
    console.error("Error updating campaign status:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Release one chunk immediately without waiting for the scheduler.
 * Useful for a first smoke test before leaving a campaign to run.
 */
exports.sendNow = async (req, res) => {
  try {
    const campaign = await EmailCampaign.findByPk(req.params.id, {
      include: [
        { model: Center, as: "center", attributes: ["center_name"] },
        { model: TrainingBatch, as: "batch", attributes: ["tb_name"] },
      ],
    });

    if (!campaign) {
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }

    // The scheduler may already be draining this campaign. Claiming it here
    // means the two cannot select the same pending recipients and send twice.
    if (!dispatcher.claim(campaign.ec_id)) {
      return res.status(409).json({
        success: false,
        message: "This campaign is already sending a chunk right now",
      });
    }

    try {
      if (campaign.ec_status !== "running") {
        await campaign.update({ ec_status: "running" });
      }

      const sent = await dispatcher.sendChunk(campaign);
      const finishedAt = new Date();
      await campaign.update({
        ec_last_run_at: finishedAt,
        ec_next_run_at: dispatcher.computeNextRunAt(campaign, finishedAt),
      });

      return res.json({
        success: true,
        message: `Released ${sent} message(s)`,
        sent,
        campaign,
      });
    } finally {
      dispatcher.release(campaign.ec_id);
    }
  } catch (error) {
    console.error("Error sending campaign chunk:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/** Render the template with a real candidate so it can be checked before sending. */
exports.previewTemplate = async (req, res) => {
  try {
    const {
      tb_id,
      center_id,
      ec_subject,
      ec_interview_date,
      ec_interview_time,
      ec_reporting_time,
      ec_venue,
      ec_contact_person,
      ec_contact_phone,
      ec_message,
      isReminder,
    } = req.body || {};

    const sample = await Candidate.findOne({
      where: {
        ...(tb_id ? { tb_id: Number(tb_id) } : {}),
        ...(center_id ? { center_id: Number(center_id) } : {}),
      },
      include: [
        { model: Course, as: "courses", attributes: ["course_name", "course_full_name"] },
        { model: Center, as: "centers", attributes: ["center_name"] },
        { model: TrainingBatch, as: "training_batches", attributes: ["tb_name"] },
      ],
      order: [["cand_id", "DESC"]],
    });

    const rendered = interviewCall({
      name: sample?.cand_name || "Applicant Name",
      fatherName: sample?.cand_fathername || "Father Name",
      cnic: sample?.cand_cnic || "00000-0000000-0",
      phone: sample?.cand_phone || "03000000000",
      applicationId: sample?.cand_id || 0,
      courseName:
        sample?.courses?.course_full_name || sample?.courses?.course_name || "Course",
      centerName: sample?.centers?.center_name || "Center",
      batchName: sample?.training_batches?.tb_name || "",
      interviewDate: ec_interview_date,
      interviewTime: ec_interview_time,
      reportingTime: ec_reporting_time,
      venue: ec_venue,
      contactPerson: ec_contact_person,
      contactPhone: ec_contact_phone,
      message: ec_message,
      isReminder: Boolean(isReminder),
      subject: ec_subject,
    });

    return res.json({
      success: true,
      usedRealCandidate: Boolean(sample),
      ...rendered,
    });
  } catch (error) {
    console.error("Error rendering campaign preview:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


