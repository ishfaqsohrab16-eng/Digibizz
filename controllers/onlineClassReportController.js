const { Op } = require("sequelize");
const OnlineClassReport = require("../models/onlineClassReportModel");
const MasterTrainer = require("../models/masterTrainersModel");
const User = require("../models/userModel");
const { onlineCentersFor, onlineCenterFor } = require("../utils/onlineReportScope");
const { attendanceByCourse } = require("../utils/onlineReportMetrics");
const {
  ONLINE_QUESTIONS,
  cleanAnswers,
  unanswered,
} = require("../utils/onlineReportForm");
const {
  weekOf,
  weekFromKey,
  recentWeeks,
  isReportable,
  isChased,
  START_WEEK,
} = require("../utils/evaluationWeek");
const { canReview, isMasterTrainer, isViewer } = require("../utils/evaluationAccess");

/**
 * The Online Classes Report.
 *
 * Part of the weekly M&E module, for the centres its per-trainer report does
 * not cover: online and hybrid. One report per centre per week, filed by one
 * Master Trainer - whoever starts it first - and read by admins, who can see
 * which centres nobody has reported on. A Super Admin marks it reviewed.
 *
 * Mirrors the Online Cell rule in the centre-visit module: a report somebody
 * else has started is shown as theirs, read-only, with their name on it,
 * rather than hidden - two people setting out to write the same report is
 * exactly what the list exists to prevent.
 */

const masterTrainerFor = async (user) => {
  if (!isMasterTrainer(user)) return null;
  const row = await MasterTrainer.findOne({
    where: { user_id: user.id },
    attributes: ["mt_id", "user_id", "mt_course_id"],
    raw: true,
  });
  return row || null;
};

const resolveBatch = (raw) => {
  const tb_id = Number(raw);
  return Number.isInteger(tb_id) && tb_id > 0 ? tb_id : null;
};

/** The week named by a request, or the current one. */
const resolveWeek = (raw) => {
  if (!raw) return { week: weekOf() };

  const week = weekFromKey(raw);
  if (!week) return { error: `"${raw}" is not a week this report understands` };
  if (!isReportable(week)) return { error: "That week has not happened yet" };

  return { week };
};

const textFrom = (value, max) => {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
};

/** Who filed each report, for a list that has to read as people. */
const namesFor = async (mtIds) => {
  const ids = [...new Set(mtIds.filter(Boolean).map(Number))];
  if (ids.length === 0) return {};

  const rows = await MasterTrainer.findAll({
    where: { mt_id: { [Op.in]: ids } },
    attributes: ["mt_id"],
    include: [{ model: User, as: "user", attributes: ["user_name"] }],
  });

  return Object.fromEntries(
    rows.map((row) => [row.mt_id, row.user?.user_name || `Master Trainer ${row.mt_id}`])
  );
};

/**
 * Every online and hybrid centre for one week, and where its report stands.
 *
 * One endpoint for both audiences. A Master Trainer uses it to see which
 * centres still need a report and which a colleague already has; an admin
 * uses it to see which centres nobody reported on.
 */
exports.list = async (req, res) => {
  try {
    const mt = await masterTrainerFor(req.user);
    if (!mt && !isViewer(req.user)) {
      return res.status(403).json({ success: false, message: "Not for you" });
    }

    const tb_id = resolveBatch(req.query.tb_id);
    if (!tb_id) {
      return res.status(400).json({ success: false, message: "Choose a batch first" });
    }

    const { week, error } = resolveWeek(req.query.week);
    if (error) return res.status(400).json({ success: false, message: error });

    const centers = await onlineCentersFor(tb_id, week);

    const reports = centers.length
      ? await OnlineClassReport.findAll({
          where: {
            tb_id,
            ocr_week_key: week.key,
            ocr_center_id: { [Op.in]: centers.map((center) => center.center_id) },
          },
          attributes: [
            "ocr_id",
            "ocr_center_id",
            "mt_id",
            "ocr_status",
            "ocr_submitted_on",
            "ocr_reviewed_by_name",
          ],
          raw: true,
        })
      : [];

    const names = await namesFor(reports.map((report) => report.mt_id));
    const byCenter = Object.fromEntries(reports.map((report) => [report.ocr_center_id, report]));

    const rows = centers.map((center) => {
      const report = byCenter[center.center_id];
      const mine = Boolean(report && mt && Number(report.mt_id) === Number(mt.mt_id));

      return {
        center_id: center.center_id,
        center_name: center.center_name,
        medium: center.medium,
        courses: center.courses.map((course) => course.course_name),
        status: report ? report.ocr_status : "missing",
        // A draft is its author's working copy. To anybody else it is only the
        // fact that somebody has started - not something to open.
        ocr_id: report && (report.ocr_status !== "draft" || mine) ? report.ocr_id : null,
        filed_by: report ? names[report.mt_id] || null : null,
        mine,
        submitted_on: report?.ocr_submitted_on || null,
        reviewed_by: report?.ocr_reviewed_by_name || null,
      };
    });

    // A week from before this module took over was reported on paper, so
    // nothing is outstanding for it.
    const chased = isChased(week);
    const count = (status) => rows.filter((row) => row.status === status).length;

    return res.json({
      success: true,
      week,
      weeks: recentWeeks(12),
      chased,
      startWeek: START_WEEK,
      isMasterTrainer: Boolean(mt),
      rows,
      summary: {
        centers: rows.length,
        submitted: count("submitted"),
        reviewed: count("reviewed"),
        draft: count("draft"),
        missing: chased ? count("missing") : 0,
      },
    });
  } catch (error) {
    console.error("[online-report] list failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Could not load the online centres" });
  }
};

/** The form for one centre and one week. */
exports.prepare = async (req, res) => {
  try {
    const mt = await masterTrainerFor(req.user);
    if (!mt) {
      return res
        .status(403)
        .json({ success: false, message: "Only a Master Trainer can file this report" });
    }

    const tb_id = resolveBatch(req.query.tb_id);
    if (!tb_id) {
      return res.status(400).json({ success: false, message: "Choose a batch first" });
    }

    const { week, error } = resolveWeek(req.query.week);
    if (error) return res.status(400).json({ success: false, message: error });

    const center = await onlineCenterFor(tb_id, week, req.query.center_id);
    if (!center) {
      return res.status(404).json({
        success: false,
        message: "That is not an online or hybrid centre with a class running this week",
      });
    }

    const existing = await OnlineClassReport.findOne({
      where: { tb_id, ocr_week_key: week.key, ocr_center_id: center.center_id },
    });

    const mine = Boolean(existing && Number(existing.mt_id) === Number(mt.mt_id));
    const names = existing ? await namesFor([existing.mt_id]) : {};

    // Somebody else's draft: say whose it is, show nothing of what they have
    // written - it is not finished, and it is not this person's to read.
    const hidden = existing && !mine && existing.ocr_status === "draft";

    // A signed report shows what the register said when it was signed; a
    // draft, or a blank form, shows it as it stands now.
    const attendance =
      existing && existing.ocr_status !== "draft" && existing.ocr_attendance
        ? existing.ocr_attendance
        : await attendanceByCourse(center, tb_id, week);

    return res.json({
      success: true,
      center,
      week,
      questions: ONLINE_QUESTIONS,
      attendance,
      report: hidden ? null : existing,
      filed_by: existing ? names[existing.mt_id] || null : null,
      // Editable only by whoever started it, and only while it is a draft.
      editable: !existing || (mine && existing.ocr_status === "draft"),
      // One report per centre: somebody else already has this one.
      claimed: Boolean(existing) && !mine,
    });
  } catch (error) {
    console.error("[online-report] prepare failed:", error);
    return res.status(500).json({ success: false, message: "Could not open that report" });
  }
};

/** Save a report, as a draft or submitted. */
exports.save = async (req, res) => {
  try {
    const mt = await masterTrainerFor(req.user);
    if (!mt) {
      return res
        .status(403)
        .json({ success: false, message: "Only a Master Trainer can file this report" });
    }

    const tb_id = resolveBatch(req.body?.tb_id);
    if (!tb_id) return res.status(400).json({ success: false, message: "Which batch?" });

    const { week, error } = resolveWeek(req.body?.week_key);
    if (error) return res.status(400).json({ success: false, message: error });

    const center = await onlineCenterFor(tb_id, week, req.body?.center_id);
    if (!center) {
      return res.status(404).json({
        success: false,
        message: "That is not an online or hybrid centre with a class running this week",
      });
    }

    const submitting = req.body?.status === "submitted";

    const existing = await OnlineClassReport.findOne({
      where: { tb_id, ocr_week_key: week.key, ocr_center_id: center.center_id },
    });

    // THE RULE. One report per centre per week, between everybody - so a
    // report somebody else started is theirs, whatever state it is in.
    if (existing) {
      const mine = Number(existing.mt_id) === Number(mt.mt_id);

      if (!mine) {
        const names = await namesFor([existing.mt_id]);
        return res.status(409).json({
          success: false,
          message: `${
            names[existing.mt_id] || "Another Master Trainer"
          } has already filed the Online Classes Report for ${center.center_name} this week. There is one per centre.`,
        });
      }

      if (existing.ocr_status !== "draft") {
        return res.status(409).json({
          success: false,
          message:
            existing.ocr_status === "reviewed"
              ? "That report has been reviewed and cannot be changed"
              : "That report was already submitted and cannot be changed",
        });
      }
    }

    const answers = cleanAnswers(req.body?.answers);

    if (submitting) {
      const missing = unanswered(answers);
      if (missing.length) {
        return res.status(400).json({
          success: false,
          message: `Before submitting, please answer: ${missing.join(", ")}`,
        });
      }
    }

    const values = {
      mt_id: mt.mt_id,
      ocr_center_id: center.center_id,
      ocr_center_name: center.center_name,
      ocr_medium: center.medium || null,
      tb_id,
      ocr_week_key: week.key,
      ocr_week_start: week.start,
      ocr_week_end: week.end,
      ocr_answers: answers,
      ocr_remarks: textFrom(req.body?.remarks, 4000),
      ocr_status: submitting ? "submitted" : "draft",
      ocr_submitted_on: submitting ? new Date() : null,
      // Counted at the moment of signing and kept. A draft stores nothing and
      // reads the register live each time it is opened.
      ocr_attendance: submitting ? await attendanceByCourse(center, tb_id, week) : null,
    };

    const report = existing
      ? await existing.update(values)
      : await OnlineClassReport.create(values);

    console.log(
      `[online-report] ${submitting ? "submitted" : "saved a draft of"} the ${week.key} ` +
        `report for ${center.center_name} (batch ${tb_id}) by mt ${mt.mt_id}`
    );

    return res.json({
      success: true,
      message: submitting ? "Online Classes Report submitted" : "Draft saved",
      report,
    });
  } catch (error) {
    // The unique index doing its job: two Master Trainers starting the same
    // centre in the same moment.
    if (error?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message:
          "Another Master Trainer started this centre's report while you were writing. Reload to see it.",
      });
    }

    console.error("[online-report] save failed:", error);
    return res.status(500).json({ success: false, message: "Could not save that report" });
  }
};

/** One report, in full. */
exports.show = async (req, res) => {
  try {
    const mt = await masterTrainerFor(req.user);
    if (!mt && !isViewer(req.user)) {
      return res.status(403).json({ success: false, message: "Not for you" });
    }

    const report = await OnlineClassReport.findOne({
      where: { ocr_id: Number(req.params.id) || 0 },
    });
    if (!report) return res.status(404).json({ success: false, message: "No such report" });

    // A draft is its author's own working copy.
    const mine = Boolean(mt && Number(report.mt_id) === Number(mt.mt_id));
    if (report.ocr_status === "draft" && !mine) {
      return res.status(404).json({ success: false, message: "No such report" });
    }

    const names = await namesFor([report.mt_id]);
    const week = weekFromKey(report.ocr_week_key);

    // Snapshotted once submitted. A draft shown to its author reads live.
    let attendance = report.ocr_attendance;
    if (!attendance && week) {
      const center = await onlineCenterFor(report.tb_id, week, report.ocr_center_id);
      attendance = center ? await attendanceByCourse(center, report.tb_id, week) : [];
    }

    return res.json({
      success: true,
      report,
      questions: ONLINE_QUESTIONS,
      attendance: attendance || [],
      filed_by: names[report.mt_id] || null,
      week,
      reviewable: canReview(req.user) && report.ocr_status !== "draft",
    });
  } catch (error) {
    console.error("[online-report] show failed:", error);
    return res.status(500).json({ success: false, message: "Could not load that report" });
  }
};

/** Mark a report as read, or withdraw that. Super Admins only. */
exports.review = async (req, res) => {
  try {
    if (!canReview(req.user)) {
      return res
        .status(403)
        .json({ success: false, message: "Only a Super Admin can review a report" });
    }

    const report = await OnlineClassReport.findOne({
      where: { ocr_id: Number(req.params.id) || 0 },
    });
    if (!report) return res.status(404).json({ success: false, message: "No such report" });

    if (report.ocr_status === "draft") {
      return res
        .status(409)
        .json({ success: false, message: "That report has not been submitted yet" });
    }

    const undo = req.body?.reviewed === false;
    if (!undo && report.ocr_status === "reviewed") {
      return res.json({ success: true, message: "Already reviewed", report });
    }

    const reviewer = await User.findOne({
      where: { user_id: req.user.id },
      attributes: ["user_name"],
      raw: true,
    });

    await report.update(
      undo
        ? {
            ocr_status: "submitted",
            ocr_reviewed_by: null,
            ocr_reviewed_by_name: null,
            ocr_reviewed_on: null,
            ocr_review_note: null,
          }
        : {
            ocr_status: "reviewed",
            ocr_reviewed_by: req.user.id,
            ocr_reviewed_by_name: String(reviewer?.user_name || "").slice(0, 150) || null,
            ocr_reviewed_on: new Date(),
            ocr_review_note: textFrom(req.body?.note, 2000),
          }
    );

    console.log(
      `[online-report] ${report.ocr_id} ${undo ? "un-reviewed" : "reviewed"} by user ${req.user.id}`
    );

    return res.json({
      success: true,
      message: undo ? "Review withdrawn" : "Marked as reviewed",
      report,
    });
  } catch (error) {
    console.error("[online-report] review failed:", error);
    return res.status(500).json({ success: false, message: "Could not review that report" });
  }
};
