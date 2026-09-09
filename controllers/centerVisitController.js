const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const CenterVisit = require("../models/centerVisitModel");
const MasterTrainer = require("../models/masterTrainersModel");
const User = require("../models/userModel");
const { centersToVisit, centerToVisit } = require("../utils/visitScope");
const {
  VISIT_QUESTIONS,
  SHARED_OWNER,
  cleanAnswers,
  unanswered,
  ownerFor,
} = require("../utils/visitForm");
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
 * The weekly centre visit.
 *
 * A Master Trainer goes to every centre with a class running, fills in the
 * Visit Report Proforma, and attaches photographs or video from the visit. A
 * Super Admin reads it and marks it reviewed.
 *
 * WHO FILES WHAT DIFFERS BY CENTRE.
 *
 *   EVERY MASTER TRAINER VISITS EVERY PHYSICAL CENTRE and files their own
 *   report, so a centre with five MTs has five. They go on different days and
 *   see different things - one arrives to find the projector broken, another
 *   finds it fixed - and collapsing that into one report would throw away the
 *   disagreement, which is the most informative part of it.
 *
 *   THE ONLINE CELL is filed once, by whoever gets there first. Nobody travels
 *   to it and there is nothing to see twice.
 *
 * utils/visitForm.js turns that into one value, cv_owner_id, so the database
 * enforces both rules with a single unique index. The checks here exist to
 * make a refusal say something useful rather than surfacing as a constraint
 * error.
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

/** The name of whoever filed a visit, for a list that has to read as people. */
const namesFor = async (mtIds) => {
  if (mtIds.length === 0) return {};

  const rows = await MasterTrainer.findAll({
    where: { mt_id: { [Op.in]: mtIds } },
    attributes: ["mt_id"],
    include: [{ model: User, as: "user", attributes: ["user_name"] }],
  });

  return Object.fromEntries(
    rows.map((row) => [row.mt_id, row.user?.user_name || `Master Trainer ${row.mt_id}`])
  );
};

/**
 * Every centre needing a visit this week, and where each stands.
 *
 * The screen the module opens on. A centre already visited shows who went, so
 * nobody sets off to one a colleague covered this morning.
 */
exports.centers = async (req, res) => {
  try {
    const mt = await masterTrainerFor(req.user);
    if (!mt && !isViewer(req.user)) {
      return res.status(403).json({ success: false, message: "Master Trainers only" });
    }

    const tb_id = resolveBatch(req.query.tb_id);
    if (!tb_id) {
      return res.status(400).json({ success: false, message: "Choose a batch first" });
    }

    const { week, error } = resolveWeek(req.query.week);
    if (error) return res.status(400).json({ success: false, message: error });

    const centers = await centersToVisit(tb_id, week);

    // Only the reports that belong to this Master Trainer: their own at each
    // physical centre, plus the single shared one for the Online Cell. Another
    // MT's report on the same centre is theirs and not shown as this one's.
    const owners = mt ? [Number(mt.mt_id), SHARED_OWNER] : [SHARED_OWNER];

    const visits = centers.length
      ? await CenterVisit.findAll({
          where: {
            tb_id,
            cv_week_key: week.key,
            cv_owner_id: { [Op.in]: owners },
            cv_center_id: { [Op.in]: centers.map((entry) => entry.center_id) },
          },
          attributes: [
            "cv_id",
            "cv_center_id",
            "cv_owner_id",
            "mt_id",
            "cv_status",
            "cv_visit_date",
            "cv_submitted_on",
            "cv_media",
          ],
          raw: true,
        })
      : [];

    const names = await namesFor([...new Set(visits.map((row) => row.mt_id))]);
    const visitBy = Object.fromEntries(visits.map((row) => [row.cv_center_id, row]));

    return res.json({
      success: true,
      week,
      weeks: recentWeeks(12),
      chased: isChased(week),
      startWeek: START_WEEK,
      centers: centers.map((center) => {
        const visit = visitBy[center.center_id];
        return {
          ...center,
          visit: visit
            ? {
                cv_id: visit.cv_id,
                status: visit.cv_status,
                visit_date: visit.cv_visit_date,
                submitted_on: visit.cv_submitted_on,
                media: Array.isArray(visit.cv_media) ? visit.cv_media.length : 0,
                by: names[visit.mt_id] || null,
                // Whether the person asking is the one who started it. A draft
                // belongs to its author; a submitted report belongs to nobody.
                mine: mt ? Number(visit.mt_id) === Number(mt.mt_id) : false,
              }
            : null,
        };
      }),
    });
  } catch (error) {
    console.error("[visit] centers failed:", error);
    return res.status(500).json({ success: false, message: "Could not load the centres" });
  }
};

/** The form for one centre and one week. */
exports.prepare = async (req, res) => {
  try {
    const mt = await masterTrainerFor(req.user);
    if (!mt && !isViewer(req.user)) {
      return res.status(403).json({ success: false, message: "Master Trainers only" });
    }

    const tb_id = resolveBatch(req.query.tb_id);
    if (!tb_id) {
      return res.status(400).json({ success: false, message: "Choose a batch first" });
    }

    const { week, error } = resolveWeek(req.query.week);
    if (error) return res.status(400).json({ success: false, message: error });

    // Resolved against the centres that genuinely had a class this week, never
    // trusted from the request.
    const center = await centerToVisit(tb_id, week, req.query.center_id);
    if (!center) {
      return res.status(404).json({
        success: false,
        message: "No class was running at that centre this week",
      });
    }

    // The report this person would be filling in: their own at a physical
    // centre, the shared one at the Online Cell.
    const existing = await CenterVisit.findOne({
      where: {
        tb_id,
        cv_week_key: week.key,
        cv_center_id: center.center_id,
        cv_owner_id: ownerFor(center, mt?.mt_id ?? -1),
      },
    });

    const names = existing ? await namesFor([existing.mt_id]) : {};
    const mine = existing && mt ? Number(existing.mt_id) === Number(mt.mt_id) : false;

    return res.json({
      success: true,
      week,
      weeks: recentWeeks(12),
      questions: VISIT_QUESTIONS,
      center,
      visit: existing,
      filed_by: existing ? names[existing.mt_id] || null : null,
      // Editable only by the person who started it, and only while it is a
      // draft. Once submitted it is signed off and nobody rewrites it.
      editable: Boolean(mt) && (!existing || (mine && existing.cv_status === "draft")),
      // Only ever true for the Online Cell: at a physical centre this MT has
      // their own report, so somebody else's cannot be in the way. The form is
      // shown read-only rather than hidden, because knowing what they found is
      // the useful part.
      claimed: Boolean(existing) && !mine,
      reviewable: canReview(req.user) && existing && existing.cv_status !== "draft",
    });
  } catch (error) {
    console.error("[visit] prepare failed:", error);
    return res.status(500).json({ success: false, message: "Could not open that visit" });
  }
};

/** Where uploaded media lives, relative to the application root. */
const MEDIA_DIR = "uploads/center-visits";

/** Remove files that were uploaded and then rejected, so they do not pile up. */
const discard = (files) => {
  for (const file of files || []) {
    fs.unlink(path.join(MEDIA_DIR, file.filename), () => {});
  }
};

/**
 * Save a visit, as a draft or submitted.
 *
 * Media arrives as multipart, so the rest of the form is form fields; the
 * answers come as a JSON string because a nested object cannot survive
 * multipart on its own.
 */
exports.save = async (req, res) => {
  const uploaded = req.files || [];

  try {
    const mt = await masterTrainerFor(req.user);
    if (!mt) {
      discard(uploaded);
      return res
        .status(403)
        .json({ success: false, message: "Only a Master Trainer can file a visit" });
    }

    const tb_id = resolveBatch(req.body?.tb_id);
    if (!tb_id) {
      discard(uploaded);
      return res.status(400).json({ success: false, message: "Which batch?" });
    }

    const { week, error } = resolveWeek(req.body?.week_key);
    if (error) {
      discard(uploaded);
      return res.status(400).json({ success: false, message: error });
    }

    const center = await centerToVisit(tb_id, week, req.body?.center_id);
    if (!center) {
      discard(uploaded);
      return res.status(404).json({
        success: false,
        message: "No class was running at that centre this week",
      });
    }

    const submitting = req.body?.status === "submitted";

    const owner = ownerFor(center, mt.mt_id);

    const existing = await CenterVisit.findOne({
      where: {
        tb_id,
        cv_week_key: week.key,
        cv_center_id: center.center_id,
        cv_owner_id: owner,
      },
    });

    // At a physical centre the owner is this MT, so the row found can only ever be
    // their own report. At the Online Cell it is the shared sentinel, so it may
    // be a colleague's - and that one is first-come.
    if (existing) {
      const mine = Number(existing.mt_id) === Number(mt.mt_id);

      if (!mine) {
        discard(uploaded);
        const names = await namesFor([existing.mt_id]);
        return res.status(409).json({
          success: false,
          message: `${names[existing.mt_id] || "Another Master Trainer"} has already filed the Online Cell visit for this week. There is one between everybody.`,
        });
      }

      if (existing.cv_status !== "draft") {
        discard(uploaded);
        return res.status(409).json({
          success: false,
          message:
            existing.cv_status === "reviewed"
              ? "That visit has been reviewed and cannot be changed"
              : "That visit was already submitted and cannot be changed",
        });
      }
    }

    // The answers travel as JSON because multipart cannot carry a nested
    // object. A malformed body is rejected rather than stored as an empty
    // form that looks filled in.
    let rawAnswers = req.body?.answers;
    if (typeof rawAnswers === "string") {
      try {
        rawAnswers = JSON.parse(rawAnswers);
      } catch {
        discard(uploaded);
        return res.status(400).json({ success: false, message: "The answers were not readable" });
      }
    }

    const answers = cleanAnswers(rawAnswers);

    if (submitting) {
      const missing = unanswered(answers);
      if (missing.length) {
        discard(uploaded);
        return res.status(400).json({
          success: false,
          message: `Before submitting, please answer: ${missing.join(", ")}`,
        });
      }

      if (!req.body?.visit_date) {
        discard(uploaded);
        return res
          .status(400)
          .json({ success: false, message: "Please give the date of the visit" });
      }
    }

    // Added to whatever is already there, never replacing it - a second save
    // that dropped the first save's photographs would lose evidence somebody
    // travelled to collect.
    const media = [
      ...(Array.isArray(existing?.cv_media) ? existing.cv_media : []),
      ...uploaded.map((file) => ({
        file: file.filename,
        type: String(file.mimetype || "").startsWith("video") ? "video" : "image",
        size: file.size,
      })),
    ];

    const values = {
      mt_id: mt.mt_id,
      cv_owner_id: owner,
      cv_center_id: center.center_id,
      cv_center_name: center.center_name,
      tb_id,
      cv_week_key: week.key,
      cv_week_start: week.start,
      cv_week_end: week.end,
      cv_visit_date: textFrom(req.body?.visit_date, 10),
      cv_visit_time: textFrom(req.body?.visit_time, 10),
      cv_answers: answers,
      cv_remarks: textFrom(req.body?.remarks, 4000),
      cv_media: media,
      cv_status: submitting ? "submitted" : "draft",
      cv_submitted_on: submitting ? new Date() : null,
    };

    const visit = existing ? await existing.update(values) : await CenterVisit.create(values);

    console.log(
      `[visit] ${submitting ? "submitted" : "saved a draft of"} the ${week.key} visit to ` +
        `${center.center_name} (batch ${tb_id}) by mt ${mt.mt_id}, ${media.length} file(s)`
    );

    return res.json({
      success: true,
      message: submitting ? "Visit report submitted" : "Draft saved",
      visit,
    });
  } catch (error) {
    discard(uploaded);

    // The unique index doing its job: two Master Trainers submitting the same
    // centre at the same moment.
    if (error?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message:
          "Somebody else filed the Online Cell visit while you were writing. Reload to see it.",
      });
    }

    console.error("[visit] save failed:", error);
    return res.status(500).json({ success: false, message: "Could not save that visit" });
  }
};

/** Remove one photograph from a draft. */
exports.removeMedia = async (req, res) => {
  try {
    const mt = await masterTrainerFor(req.user);
    if (!mt) return res.status(403).json({ success: false, message: "Master Trainers only" });

    const visit = await CenterVisit.findOne({ where: { cv_id: Number(req.params.id) || 0 } });
    if (!visit) return res.status(404).json({ success: false, message: "No such visit" });

    if (Number(visit.mt_id) !== Number(mt.mt_id) || visit.cv_status !== "draft") {
      return res.status(403).json({
        success: false,
        message: "Only the person who filed it can change it, and only before submitting",
      });
    }

    const file = String(req.body?.file || "");
    const media = (Array.isArray(visit.cv_media) ? visit.cv_media : []).filter(
      (entry) => entry.file !== file
    );

    await visit.update({ cv_media: media });
    // Only after the row is saved: a file deleted before the record would
    // leave the report pointing at something that is not there.
    fs.unlink(path.join(MEDIA_DIR, path.basename(file)), () => {});

    return res.json({ success: true, message: "Removed", visit });
  } catch (error) {
    console.error("[visit] removeMedia failed:", error);
    return res.status(500).json({ success: false, message: "Could not remove that file" });
  }
};

/** One visit, in full. */
exports.show = async (req, res) => {
  try {
    const mt = await masterTrainerFor(req.user);
    if (!mt && !isViewer(req.user)) {
      return res.status(403).json({ success: false, message: "Not for you" });
    }

    const visit = await CenterVisit.findOne({ where: { cv_id: Number(req.params.id) || 0 } });
    if (!visit) return res.status(404).json({ success: false, message: "No such visit" });

    // A draft is its author's own working copy.
    const mine = mt && Number(visit.mt_id) === Number(mt.mt_id);
    if (visit.cv_status === "draft" && !mine) {
      return res.status(404).json({ success: false, message: "No such visit" });
    }

    const names = await namesFor([visit.mt_id]);

    return res.json({
      success: true,
      visit,
      questions: VISIT_QUESTIONS,
      filed_by: names[visit.mt_id] || null,
      week: weekFromKey(visit.cv_week_key),
      reviewable: canReview(req.user) && visit.cv_status !== "draft",
    });
  } catch (error) {
    console.error("[visit] show failed:", error);
    return res.status(500).json({ success: false, message: "Could not load that visit" });
  }
};

/**
 * Every centre for one week, visited or not.
 *
 * The admin view, and the unvisited centres are the point of it.
 */
exports.overview = async (req, res) => {
  try {
    if (!isViewer(req.user)) {
      return res.status(403).json({ success: false, message: "Not for you" });
    }

    const tb_id = resolveBatch(req.query.tb_id);
    if (!tb_id) {
      return res.status(400).json({ success: false, message: "Choose a batch first" });
    }

    const { week, error } = resolveWeek(req.query.week);
    if (error) return res.status(400).json({ success: false, message: error });

    const centers = await centersToVisit(tb_id, week);

    const visits = await CenterVisit.findAll({
      where: { tb_id, cv_week_key: week.key },
      attributes: [
        "cv_id",
        "cv_center_id",
        "cv_owner_id",
        "mt_id",
        "cv_status",
        "cv_visit_date",
        "cv_visit_time",
        "cv_submitted_on",
        "cv_media",
      ],
      raw: true,
    });

    // How many reports a physical centre SHOULD have: one per Master Trainer,
    // because every one of them visits every centre. The Online Cell expects
    // exactly one however many there are.
    const expected = await MasterTrainer.count();

    const names = await namesFor([...new Set(visits.map((row) => row.mt_id))]);

    const byCenter = {};
    for (const row of visits) {
      if (!byCenter[row.cv_center_id]) byCenter[row.cv_center_id] = [];
      byCenter[row.cv_center_id].push(row);
    }

    const rows = centers.map((center) => {
      const filed = (byCenter[center.center_id] || []).map((row) => ({
        cv_id: row.cv_id,
        status: row.cv_status,
        by: names[row.mt_id] || null,
        visit_date: row.cv_visit_date,
        visit_time: row.cv_visit_time,
        media: Array.isArray(row.cv_media) ? row.cv_media.length : 0,
      }));

      const done = filed.filter((entry) => entry.status !== "draft").length;
      const wanted = center.online_cell ? 1 : Math.max(expected, 1);

      return {
        center_id: center.center_id,
        center_name: center.center_name,
        online_cell: center.online_cell,
        covers: center.covers || [],
        // Per centre now, not per report: a physical centre is expected to
        // collect one from each Master Trainer, so "3 of 5" is the fact that
        // matters and a single status would hide four of them.
        expected: wanted,
        done,
        status: done === 0 ? "missing" : done >= wanted ? "complete" : "partial",
        visits: filed,
      };
    });

    // A week before this module took over was recorded on paper, so nothing
    // is outstanding for it.
    const chased = isChased(week);

    return res.json({
      success: true,
      week,
      weeks: recentWeeks(12),
      chased,
      startWeek: START_WEEK,
      masterTrainers: expected,
      rows,
      summary: {
        centers: rows.length,
        // Reports, not centres - the unit people are counting is the visit.
        expected: chased ? rows.reduce((sum, row) => sum + row.expected, 0) : 0,
        done: rows.reduce((sum, row) => sum + row.done, 0),
        complete: rows.filter((row) => row.status === "complete").length,
        partial: rows.filter((row) => row.status === "partial").length,
        missing: chased ? rows.filter((row) => row.status === "missing").length : 0,
      },
    });
  } catch (error) {
    console.error("[visit] overview failed:", error);
    return res.status(500).json({ success: false, message: "Could not load the overview" });
  }
};

/** Mark a visit as read, or withdraw that. Super Admins only. */
exports.review = async (req, res) => {
  try {
    if (!canReview(req.user)) {
      return res
        .status(403)
        .json({ success: false, message: "Only a Super Admin can review a visit" });
    }

    const visit = await CenterVisit.findOne({ where: { cv_id: Number(req.params.id) || 0 } });
    if (!visit) return res.status(404).json({ success: false, message: "No such visit" });

    if (visit.cv_status === "draft") {
      return res
        .status(409)
        .json({ success: false, message: "That visit has not been submitted yet" });
    }

    const undo = req.body?.reviewed === false;
    if (!undo && visit.cv_status === "reviewed") {
      return res.json({ success: true, message: "Already reviewed", visit });
    }

    const reviewer = await User.findOne({
      where: { user_id: req.user.id },
      attributes: ["user_name"],
      raw: true,
    });

    await visit.update(
      undo
        ? {
            cv_status: "submitted",
            cv_reviewed_by: null,
            cv_reviewed_by_name: null,
            cv_reviewed_on: null,
            cv_review_note: null,
          }
        : {
            cv_status: "reviewed",
            cv_reviewed_by: req.user.id,
            cv_reviewed_by_name: String(reviewer?.user_name || "").slice(0, 150) || null,
            cv_reviewed_on: new Date(),
            cv_review_note: textFrom(req.body?.note, 2000),
          }
    );

    console.log(
      `[visit] ${visit.cv_id} ${undo ? "un-reviewed" : "reviewed"} by user ${req.user.id}`
    );

    return res.json({
      success: true,
      message: undo ? "Review withdrawn" : "Marked as reviewed",
      visit,
    });
  } catch (error) {
    console.error("[visit] review failed:", error);
    return res.status(500).json({ success: false, message: "Could not review that visit" });
  }
};

/** What this Master Trainer still owes, for the dashboard. */
exports.pending = async (req, res) => {
  try {
    const mt = await masterTrainerFor(req.user);
    if (!mt) return res.json({ success: true, pending: 0 });

    const week = weekOf();
    if (!isChased(week)) return res.json({ success: true, pending: 0 });

    // Across every batch that has classes running, because a Master Trainer
    // visits centres rather than batches.
    const { sequelize } = require("../config/db");
    const [batches] = await sequelize.query(
      `SELECT DISTINCT tb_id FROM trainers_center_allocation`
    );

    let outstanding = 0;

    for (const row of batches) {
      const centers = await centersToVisit(row.tb_id, week);
      if (centers.length === 0) continue;

      // This Master Trainer's own reports: theirs at each physical centre,
      // and the shared one at the Online Cell whoever filed it.
      const done = await CenterVisit.count({
        where: {
          tb_id: row.tb_id,
          cv_week_key: week.key,
          cv_status: { [Op.in]: ["submitted", "reviewed"] },
          cv_owner_id: { [Op.in]: [Number(mt.mt_id), SHARED_OWNER] },
          cv_center_id: { [Op.in]: centers.map((entry) => entry.center_id) },
        },
      });

      outstanding += Math.max(centers.length - done, 0);
    }

    return res.json({ success: true, pending: outstanding, week });
  } catch (error) {
    console.error("[visit] pending failed:", error);
    // A broken reminder must not break the dashboard around it.
    return res.json({ success: true, pending: 0 });
  }
};

exports._internals = { resolveWeek, textFrom };
