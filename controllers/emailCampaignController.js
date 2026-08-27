const fs = require("fs");
const path = require("path");
const { Op, fn, col, literal } = require("sequelize");
const db = require("../config/db");
const sequelize = db.sequelize;
const EmailCampaign = require("../models/emailCampaignModel");
const EmailCampaignRecipient = require("../models/emailCampaignRecipientModel");
const Candidate = require("../models/CandidateModel");
const Course = require("../models/course");
const Center = require("../models/center");
const TrainingBatch = require("../models/trainingBatcheModel");
const Student = require("../models/studentModel");
const User = require("../models/userModel");
const {
  interviewCall,
  renderCampaignEmail,
} = require("../servec/campaignTemplates");
const { ADMISSION_BATCH_LABEL } = require("../servec/admissionBatch");
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
 *
 * Scoped by kind: a candidate who received an interview call-up must still be
 * eligible for a recommendation letter later. Only campaigns of the SAME kind
 * count against each other, since that is what "already contacted" means to
 * the person creating this one.
 */
const alreadyContactedIds = async (
  tb_id,
  center_id,
  { excludeCampaignId, kind = "initial", audience = "candidates" } = {}
) => {
  const campaignWhere = { tb_id, center_id, ec_kind: kind };
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

  const idColumn = audience === "students" ? "std_id" : "cand_id";

  const rows = await EmailCampaignRecipient.findAll({
    where: {
      [idColumn]: { [Op.ne]: null },
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
    attributes: [[fn("DISTINCT", col(idColumn)), idColumn]],
    raw: true,
  });

  return rows.map((row) => Number(row[idColumn]));
};

/**
 * Work out exactly who a new campaign would contact.
 *
 * Shared by createCampaign and the "download the list before sending"
 * preview, deliberately: if the two computed the list separately they could
 * drift, and the whole point of the download is that it shows the people who
 * will actually be emailed.
 *
 * @returns {Promise<{chosen: object[], pool: object[], allocation: Map<number, number>, contacted: number}>}
 */
/**
 * The audience a kind is allowed to target.
 *
 * A recommendation ("you have been selected") is addressed to people who are
 * already enrolled students, so it is pinned to that audience rather than
 * merely defaulted to it: sending "you have been selected" to a candidate who
 * was not selected is the one mistake this module must make impossible.
 *
 * Because the pool is recomputed every time a campaign is created, students
 * enrolled AFTER an earlier send are simply in the pool the next time - and
 * anyone already sent to is excluded by the ledger. So "send it to whoever has
 * joined since" needs no extra bookkeeping.
 */
const audienceForKind = (kind, requested) =>
  kind === "recommendation"
    ? "students"
    : requested === "students"
    ? "students"
    : "candidates";

const selectRecipients = async (
  tb_id,
  center_id,
  target,
  { kind = "initial", audience = "candidates" } = {}
) => {
  audience = audienceForKind(kind, audience);

  const contacted = await alreadyContactedIds(Number(tb_id), Number(center_id), {
    kind,
    audience,
  });

  let pool;

  if (audience === "students") {
    // Enrolled students. Their address lives on the linked user account, not
    // on the student row, so it has to be joined in and lifted onto the same
    // shape the candidate branch produces.
    const where = { tb_id: Number(tb_id), center_id: Number(center_id) };
    if (contacted.length > 0) where.std_id = { [Op.notIn]: contacted };

    const students = await Student.findAll({
      where,
      attributes: [
        "std_id",
        "std_cnic",
        "std_phone",
        "std_fathername",
        "std_gender",
        "course_id",
      ],
      include: [
        { model: User, attributes: ["user_name", "user_email"], required: true },
        {
          model: Course,
          attributes: ["course_name", "course_full_name"],
          required: false,
        },
      ],
      order: [["std_id", "ASC"]],
    });

    pool = students
      .map((student) => ({
        std_id: student.std_id,
        cand_id: null,
        cand_name: student.User?.user_name || "",
        cand_email: student.User?.user_email || "",
        cand_fathername: student.std_fathername,
        cand_cnic: student.std_cnic,
        cand_phone: student.std_phone,
        cand_gender: student.std_gender,
        course_id: student.course_id,
        courses: student.Course || null,
      }))
      // A student with no address on their account cannot be emailed; they
      // would otherwise sit in the campaign forever, failing every attempt.
      .filter((student) => student.cand_email);
  } else {
    const where = {
      tb_id: Number(tb_id),
      center_id: Number(center_id),
      cand_email: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] },
    };
    if (contacted.length > 0) where.cand_id = { [Op.notIn]: contacted };

    pool = await Candidate.findAll({
      where,
      attributes: [
        "cand_id",
        "cand_name",
        "cand_fathername",
        "cand_email",
        "cand_phone",
        "cand_cnic",
        "cand_gender",
        "course_id",
      ],
      include: [
        {
          model: Course,
          as: "courses",
          attributes: ["course_name", "course_full_name"],
        },
      ],
      order: [["cand_id", "ASC"]],
    });
  }

  // Group by course, then split the requested total evenly across them.
  const byCourse = new Map();
  for (const person of pool) {
    const key = Number(person.course_id);
    if (!byCourse.has(key)) byCourse.set(key, []);
    byCourse.get(key).push(person);
  }

  const allocation = allocateEvenly(
    Math.max(0, Math.floor(Number(target) || 0)),
    [...byCourse.entries()].map(([key, list]) => ({
      key,
      available: list.length,
    }))
  );

  const chosen = [];
  for (const [courseId, list] of byCourse.entries()) {
    chosen.push(...list.slice(0, allocation.get(courseId) || 0));
  }

  return { chosen, pool, allocation, contacted: contacted.length };
};

/** Shape one candidate for the CSV / preview list. */
const toListRow = (candidate) => ({
  cand_id: candidate.cand_id,
  name: candidate.cand_name || "",
  father_name: candidate.cand_fathername || "",
  cnic: candidate.cand_cnic || "",
  email: candidate.cand_email || "",
  phone: candidate.cand_phone || "",
  gender: candidate.cand_gender || "",
  course:
    candidate.courses?.course_full_name || candidate.courses?.course_name || "",
});

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

    const kind = String(req.query.kind || "initial").toLowerCase();
    const audience =
      String(req.query.audience || "").toLowerCase() === "students"
        ? "students"
        : "candidates";

    // Reuse the real selection with an unreachable target, so "available" is
    // counted exactly the way the send will count it - including the
    // recommended-only filter and the per-kind contacted ledger.
    const { pool, contacted } = await selectRecipients(
      tb_id,
      center_id,
      Number.MAX_SAFE_INTEGER,
      { kind, audience }
    );

    const byCourse = new Map();
    for (const person of pool) {
      const id = Number(person.course_id);
      if (!byCourse.has(id)) {
        byCourse.set(id, {
          course_id: id,
          course_name: person.courses?.course_name || "",
          course_full_name:
            person.courses?.course_full_name || person.courses?.course_name || "",
          available: 0,
        });
      }
      byCourse.get(id).available += 1;
    }

    const courses = [...byCourse.values()];

    return res.json({
      success: true,
      alreadyContacted: contacted,
      totalAvailable: pool.length,
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
      ec_custom_html,
      ec_kind,
      ec_audience,
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

    const kind = ["initial", "reminder", "recommendation", "general"].includes(
      String(ec_kind || "").toLowerCase()
    )
      ? String(ec_kind).toLowerCase()
      : "initial";
    const audience = audienceForKind(
      kind,
      String(ec_audience || "").toLowerCase()
    );

    const { chosen, pool, allocation } = await selectRecipients(
      tb_id,
      center_id,
      target,
      { kind, audience }
    );

    if (pool.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message:
          kind === "recommendation"
            ? "There are no recommended candidates left to contact at this center."
            : audience === "students"
            ? "Every student at this center has already been contacted for this batch."
            : "Every candidate at this center has already been contacted for this batch.",
      });
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
        ec_kind: kind,
        ec_audience: audience,
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
        // Empty means "use the built-in letter", so normalise blank to NULL
        // rather than storing whitespace that would count as custom HTML.
        ec_custom_html: String(ec_custom_html || "").trim() || null,
        ec_status: startNow ? "running" : "draft",
        // Due immediately when started; the dispatcher jitters every gap after
        // the first chunk.
        ec_next_run_at: startNow ? new Date() : null,
        ec_created_by: req.user?.id || req.user?.user_id || null,
      },
      { transaction }
    );

    await EmailCampaignRecipient.bulkCreate(
      chosen.map((person) => ({
        ec_id: campaign.ec_id,
        // Exactly one of these is set; the other stays null and identifies
        // which table the recipient came from.
        cand_id: audience === "students" ? null : person.cand_id,
        std_id: audience === "students" ? person.std_id : null,
        ecr_email: person.cand_email,
        ecr_name: person.cand_name,
        course_id: person.course_id,
        ecr_status: "pending",
      })),
      { transaction }
    );

    await transaction.commit();

    // Proof copy to the test addresses, using the same render and transport a
    // real recipient gets. Sent after the commit and never awaited into the
    // failure path: a mail problem must not roll back a campaign that is
    // already correctly stored.
    const withCenter = await EmailCampaign.findByPk(campaign.ec_id, {
      include: [{ model: Center, as: "center", attributes: ["center_name"] }],
    });
    const test = await dispatcher.sendTestCopies(withCenter || campaign);

    return res.status(201).json({
      success: true,
      message: `Campaign created for ${chosen.length} candidate(s)`,
      campaign,
      allocation: [...allocation.entries()].map(([course_id, count]) => ({
        course_id,
        count,
      })),
      test,
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
        // A reminder is usually sent BECAUSE the sitting was rescheduled, so
        // the new date, time and venue are asked for and override the
        // original. Left blank they fall back to the source campaign's, which
        // is the right behaviour for a simple "you did not attend" chase.
        ec_interview_date: ec_interview_date || source.ec_interview_date,
        ec_interview_time: ec_interview_time || source.ec_interview_time,
        ec_reporting_time: ec_reporting_time || source.ec_reporting_time,
        ec_venue: ec_venue || source.ec_venue,
        ec_contact_person: ec_contact_person || source.ec_contact_person,
        ec_contact_phone: ec_contact_phone || source.ec_contact_phone,
        ec_message: ec_message ?? source.ec_message,
        ec_custom_html: source.ec_custom_html,
        ec_audience: source.ec_audience,
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

    const rescheduled = Boolean(
      ec_interview_date || ec_interview_time || ec_venue
    );

    return res.status(201).json({
      success: true,
      message: rescheduled
        ? `Reminder created for ${chosen.length} candidate(s) with the new date, time and venue`
        : `Reminder created for ${chosen.length} candidate(s) who have not been interviewed`,
      campaign,
      rescheduled,
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
      ec_target_count,
      ec_subject,
      ec_interview_date,
      ec_interview_time,
      ec_reporting_time,
      ec_venue,
      ec_contact_person,
      ec_contact_phone,
      ec_message,
      ec_custom_html,
      isReminder,
    } = req.body || {};

    // Preview the FIRST person who would actually receive this campaign, not
    // an arbitrary candidate from the center. Running the same selection the
    // send path runs means the preview shows a real recipient's data, so a
    // merge token that comes out blank here will come out blank for them too.
    let sample = null;
    if (tb_id && center_id) {
      const { chosen, pool } = await selectRecipients(
        tb_id,
        center_id,
        Number(ec_target_count) || 1,
        {
          kind: String(req.body?.ec_kind || "initial").toLowerCase(),
          audience:
            String(req.body?.ec_audience || "").toLowerCase() === "students"
              ? "students"
              : "candidates",
        }
      );
      sample = chosen[0] || pool[0] || null;
    }

    // Fall back to any candidate at all, so the editor still previews before a
    // center has been picked.
    if (!sample) {
      sample = await Candidate.findOne({
        where: {
          ...(tb_id ? { tb_id: Number(tb_id) } : {}),
          ...(center_id ? { center_id: Number(center_id) } : {}),
        },
        include: [
          {
            model: Course,
            as: "courses",
            attributes: ["course_name", "course_full_name"],
          },
        ],
        order: [["cand_id", "ASC"]],
      });
    }

    const center = center_id
      ? await Center.findByPk(Number(center_id), { attributes: ["center_name"] })
      : null;

    const rendered = renderCampaignEmail({
      kind: String(req.body?.ec_kind || "initial").toLowerCase(),
      name: sample?.cand_name || "Applicant Name",
      fatherName: sample?.cand_fathername || "Father Name",
      cnic: sample?.cand_cnic || "00000-0000000-0",
      phone: sample?.cand_phone || "03000000000",
      courseName:
        sample?.courses?.course_full_name || sample?.courses?.course_name || "Course",
      centerName: center?.center_name || sample?.centers?.center_name || "Center",
      // Must match what the dispatcher actually sends, not the database
      // tb_name. A preview showing a different batch than the real email is
      // worse than no preview - see servec/admissionBatch.js.
      batchName: ADMISSION_BATCH_LABEL,
      interviewDate: ec_interview_date,
      interviewTime: ec_interview_time,
      reportingTime: ec_reporting_time,
      venue: ec_venue,
      contactPerson: ec_contact_person,
      contactPhone: ec_contact_phone,
      message: ec_message,
      customHtml: ec_custom_html,
      isReminder: Boolean(isReminder),
      subject: ec_subject,
    });

    return res.json({
      success: true,
      usedRealCandidate: Boolean(sample),
      // Which template actually produced this, so the editor can say so rather
      // than leaving the reader to guess why it looks unfamiliar.
      usedCustomHtml: Boolean(String(ec_custom_html || "").trim()),
      previewOf: sample
        ? { cand_id: sample.cand_id, name: sample.cand_name }
        : null,
      ...rendered,
    });
  } catch (error) {
    console.error("Error rendering campaign preview:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/** RFC 4180 escaping: quote the field and double any quote inside it. */
const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const CSV_COLUMNS = [
  ["cand_id", "Application ID"],
  ["name", "Name"],
  ["father_name", "Father Name"],
  ["cnic", "CNIC"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["gender", "Gender"],
  ["course", "Course"],
];

/**
 * Render rows as CSV.
 *
 * Prefixed with a BOM so Excel reads it as UTF-8. Without it Excel assumes the
 * system codepage and mangles any non-ASCII name, which is most of this list.
 */
const toCsv = (rows, columns = CSV_COLUMNS) => {
  const header = columns.map(([, label]) => csvCell(label)).join(",");
  const body = rows.map((row) =>
    columns.map(([key]) => csvCell(row[key])).join(",")
  );
  return "﻿" + [header, ...body].join("\r\n") + "\r\n";
};

/** Filename-safe slug, so a center name cannot break the download header. */
const slug = (value) =>
  String(value || "list")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60) || "list";

const sendCsv = (res, filename, rows, columns) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.send(toCsv(rows, columns));
};

/**
 * The exact people a campaign WOULD contact, before it is created.
 *
 * Runs the same selection the real create path runs - the shared
 * selectRecipients - so what the operator downloads and checks is precisely
 * who would be emailed. A separate query here could drift from the real one,
 * which would make the review worthless.
 *
 * Returns JSON by default, or a CSV attachment with ?format=csv.
 */
exports.previewRecipients = async (req, res) => {
  try {
    const tb_id = Number(req.query.tb_id);
    const center_id = Number(req.query.center_id);
    const target = Number(req.query.count);

    if (!tb_id || !center_id) {
      return res
        .status(400)
        .json({ success: false, message: "tb_id and center_id are required" });
    }
    if (!target || target < 1) {
      return res.status(400).json({
        success: false,
        message: "Enter how many emails to send first",
      });
    }

    const { chosen, pool, contacted } = await selectRecipients(
      tb_id,
      center_id,
      target,
      {
        kind: String(req.query.kind || "initial").toLowerCase(),
        audience:
          String(req.query.audience || "").toLowerCase() === "students"
            ? "students"
            : "candidates",
      }
    );
    const rows = chosen.map(toListRow);

    if (String(req.query.format).toLowerCase() === "csv") {
      const center = await Center.findByPk(center_id, {
        attributes: ["center_name"],
      });
      return sendCsv(
        res,
        `campaign-recipients-${slug(center?.center_name)}-${rows.length}.csv`,
        rows
      );
    }

    return res.json({
      success: true,
      requested: target,
      selected: rows.length,
      available: pool.length,
      alreadyContacted: contacted,
      recipients: rows,
    });
  } catch (error) {
    console.error("Error previewing campaign recipients:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/** Download the frozen recipient list of a campaign that already exists. */
exports.exportRecipients = async (req, res) => {
  try {
    const campaign = await EmailCampaign.findByPk(req.params.id, {
      include: [{ model: Center, as: "center", attributes: ["center_name"] }],
    });

    if (!campaign) {
      return res
        .status(404)
        .json({ success: false, message: "Campaign not found" });
    }

    const recipients = await EmailCampaignRecipient.findAll({
      where: { ec_id: campaign.ec_id },
      include: [
        {
          model: Candidate,
          as: "candidate",
          attributes: [
            "cand_id",
            "cand_fathername",
            "cand_cnic",
            "cand_gender",
            "cand_phone",
          ],
        },
        {
          model: Course,
          as: "course",
          attributes: ["course_name", "course_full_name"],
        },
      ],
      order: [["ecr_id", "ASC"]],
    });

    // Name and address come from the frozen recipient row, not a live lookup:
    // the export must show the address this campaign will actually use, even
    // if the candidate record has been edited since.
    const rows = recipients.map((row) => ({
      cand_id: row.cand_id,
      name: row.ecr_name || "",
      father_name: row.candidate?.cand_fathername || "",
      cnic: row.candidate?.cand_cnic || "",
      email: row.ecr_email || "",
      phone: row.candidate?.cand_phone || "",
      gender: row.candidate?.cand_gender || "",
      course: row.course?.course_full_name || row.course?.course_name || "",
      status: row.ecr_status,
      sent_at: row.ecr_sent_at ? new Date(row.ecr_sent_at).toISOString() : "",
    }));

    return sendCsv(
      res,
      `campaign-${campaign.ec_id}-${slug(campaign.ec_name)}.csv`,
      rows,
      [...CSV_COLUMNS, ["status", "Status"], ["sent_at", "Sent At"]]
    );
  } catch (error) {
    console.error("Error exporting campaign recipients:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/** Re-send the dummy proof copy for an existing campaign. */
exports.sendTest = async (req, res) => {
  try {
    const campaign = await EmailCampaign.findByPk(req.params.id, {
      include: [{ model: Center, as: "center", attributes: ["center_name"] }],
    });

    if (!campaign) {
      return res
        .status(404)
        .json({ success: false, message: "Campaign not found" });
    }

    const test = await dispatcher.sendTestCopies(campaign);

    return res.json({
      success: test.failed.length === 0,
      message:
        test.failed.length === 0
          ? `Test copy sent to ${test.sent.join(", ")}`
          : `Sent ${test.sent.length}, failed for ${test.failed
              .map((entry) => entry.to)
              .join(", ")}`,
      ...test,
    });
  } catch (error) {
    console.error("Error sending campaign test copy:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/**
 * Starter HTML for the "Custom HTML" editor.
 *
 * Served from the file rather than duplicated as a string in the frontend, so
 * there is one copy to keep correct. Read once and cached - it is a static
 * asset that only changes on deploy.
 */
let starterTemplateCache = null;

exports.getStarterTemplate = async (req, res) => {
  try {
    if (starterTemplateCache === null) {
      const file = path.join(__dirname, "..", "servec", "templates", "interview-call.html");
      starterTemplateCache = fs.readFileSync(file, "utf8");
    }
    return res.json({ success: true, html: starterTemplateCache });
  } catch (error) {
    console.error("Error reading the starter email template:", error);
    return res
      .status(500)
      .json({ success: false, message: "Starter template is unavailable" });
  }
};
