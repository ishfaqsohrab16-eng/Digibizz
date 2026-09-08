const { Op } = require("sequelize");
const WeeklyEvaluation = require("../models/weeklyEvaluationModel");
const Trainer = require("../models/trainersModel");
const MasterTrainer = require("../models/masterTrainersModel");
const User = require("../models/userModel");
const Center = require("../models/center");
const Course = require("../models/course");
const TrainingBatch = require("../models/trainingBatcheModel");
const TrainerCenterAllocation = require("../models/trainersCenterAllocationModel");
const { metricsFor, classesFor } = require("../utils/evaluationMetrics");
const {
  weekOf,
  weekFromKey,
  recentWeeks,
  isReportable,
  isChased,
  START_WEEK,
  DAILY_CRITERIA,
  QUALITY_GRADES,
} = require("../utils/evaluationWeek");
const {
  canWrite,
  readScope,
  ownsTrainer,
  canEdit,
  isMasterTrainer,
  isViewer,
} = require("../utils/evaluationAccess");

/**
 * The weekly M&E report on trainer performance.
 *
 * A Master Trainer fills one in per trainer per week; admins read them and,
 * more importantly, see which are missing. The paper form is the contract -
 * utils/evaluationWeek.js holds its criteria and grades so the form, the API
 * and the tests cannot drift apart.
 *
 * Everything countable is offered pre-filled from the LMS and stays editable.
 * See utils/evaluationMetrics.js for what can honestly be counted and what
 * cannot.
 */

/** The Master Trainer row behind the signed-in user, or null. */
const masterTrainerFor = async (user) => {
  if (!isMasterTrainer(user)) return null;
  const row = await MasterTrainer.findOne({
    where: { user_id: user.id },
    attributes: ["mt_id", "user_id", "mt_course_id"],
    raw: true,
  });
  return row || null;
};

/** Names for a set of ids, so a report reads as places rather than numbers. */
const nameLookup = async (classes) => {
  const ids = (key) => [...new Set(classes.map((entry) => entry[key]).filter(Boolean))];

  const [centers, courses, batches] = await Promise.all([
    Center.findAll({ where: { center_id: ids("center_id") }, raw: true }),
    Course.findAll({ where: { course_id: ids("course_id") }, raw: true }),
    TrainingBatch.findAll({ where: { tb_id: ids("tb_id") }, raw: true }),
  ]);

  const centerBy = Object.fromEntries(centers.map((row) => [row.center_id, row.center_name]));
  const courseBy = Object.fromEntries(
    courses.map((row) => [row.course_id, row.course_full_name || row.course_name])
  );
  const batchBy = Object.fromEntries(batches.map((row) => [row.tb_id, row.tb_name]));

  return classes.map((entry) => ({
    ...entry,
    center_name: centerBy[entry.center_id] || `Centre ${entry.center_id}`,
    course_name: courseBy[entry.course_id] || `Course ${entry.course_id}`,
    tb_name: batchBy[entry.tb_id] || `Batch ${entry.tb_id}`,
  }));
};

/** The trainers reporting to one Master Trainer, with their classes. */
const trainersUnder = async (mt_id) => {
  const trainers = await Trainer.findAll({
    where: { mt_id },
    attributes: ["t_id", "user_id", "t_cnic", "t_course_id"],
    include: [{ model: User, as: "user", attributes: ["user_name", "user_email"] }],
  });

  return Promise.all(
    trainers.map(async (trainer) => {
      const classes = await classesFor(trainer.t_id);
      return {
        t_id: trainer.t_id,
        name: trainer.user?.user_name || `Trainer ${trainer.t_id}`,
        email: trainer.user?.user_email || null,
        cnic: trainer.t_cnic,
        classes: classes.length ? await nameLookup(classes) : [],
      };
    })
  );
};

/**
 * The week named by a query parameter, or the current one.
 *
 * A bad key is refused rather than silently treated as this week: a report
 * filed against the wrong week is worse than an error message, because nobody
 * notices until the month is being reviewed.
 */
const resolveWeek = (raw) => {
  if (!raw) return { week: weekOf() };

  const week = weekFromKey(raw);
  if (!week) return { error: `"${raw}" is not a week this report understands` };
  if (!isReportable(week)) return { error: "That week has not happened yet" };

  return { week };
};

/**
 * The trainers a Master Trainer owes reports for, and where each stands.
 *
 * The list the module opens on. A trainer with no classes allocated is still
 * listed, marked as having none - being told "there is nobody to report on" is
 * an answer, and an empty screen is not.
 */
exports.myTrainers = async (req, res) => {
  try {
    const mt = await masterTrainerFor(req.user);
    if (!mt) {
      return res.status(403).json({ success: false, message: "Master Trainers only" });
    }

    const { week, error } = resolveWeek(req.query.week);
    if (error) return res.status(400).json({ success: false, message: error });

    const trainers = await trainersUnder(mt.mt_id);

    const reports = await WeeklyEvaluation.findAll({
      where: { we_week_key: week.key, t_id: trainers.map((entry) => entry.t_id) },
      attributes: ["we_id", "t_id", "we_status", "we_submitted_on"],
      raw: true,
    });

    const reportBy = Object.fromEntries(reports.map((row) => [row.t_id, row]));

    return res.json({
      success: true,
      week,
      weeks: recentWeeks(12),
      trainers: trainers.map((trainer) => ({
        ...trainer,
        report: reportBy[trainer.t_id]
          ? {
              we_id: reportBy[trainer.t_id].we_id,
              status: reportBy[trainer.t_id].we_status,
              submitted_on: reportBy[trainer.t_id].we_submitted_on,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error("[evaluation] myTrainers failed:", error);
    return res.status(500).json({ success: false, message: "Could not load your trainers" });
  }
};

/**
 * The form for one trainer and one week, pre-filled.
 *
 * Returns the existing report when there is one - a draft to carry on with, or
 * a submitted one to read - and otherwise a blank form with every figure the
 * LMS could work out already in place.
 */
exports.prepare = async (req, res) => {
  try {
    const mt = await masterTrainerFor(req.user);
    const t_id = Number(req.query.t_id);

    if (!Number.isInteger(t_id) || t_id <= 0) {
      return res.status(400).json({ success: false, message: "Which trainer?" });
    }

    const { week, error } = resolveWeek(req.query.week);
    if (error) return res.status(400).json({ success: false, message: error });

    const trainer = await Trainer.findOne({
      where: { t_id },
      include: [{ model: User, as: "user", attributes: ["user_name", "user_email"] }],
    });
    if (!trainer) {
      return res.status(404).json({ success: false, message: "No such trainer" });
    }

    // A Master Trainer may only prepare reports for their own trainers. The
    // check is against the trainer row, not against anything in the request.
    if (mt && !ownsTrainer(mt.mt_id, trainer) && !isViewer(req.user)) {
      return res
        .status(403)
        .json({ success: false, message: "That trainer does not report to you" });
    }
    if (!mt && !isViewer(req.user)) {
      return res.status(403).json({ success: false, message: "Master Trainers only" });
    }

    const existing = await WeeklyEvaluation.findOne({
      where: { t_id, we_week_key: week.key },
    });

    // A submitted report shows what it recorded, not what the numbers say
    // today - the data moves on and the report must not.
    const metrics =
      existing && existing.we_status === "submitted" ? null : await metricsFor(t_id, week);

    const classes = existing?.we_classes?.length
      ? existing.we_classes
      : await nameLookup(await classesFor(t_id));

    return res.json({
      success: true,
      week,
      weeks: recentWeeks(12),
      criteria: DAILY_CRITERIA,
      grades: QUALITY_GRADES,
      trainer: {
        t_id: trainer.t_id,
        name: trainer.user?.user_name || `Trainer ${trainer.t_id}`,
        email: trainer.user?.user_email || null,
        cnic: trainer.t_cnic,
      },
      classes,
      metrics,
      report: existing,
      editable: existing ? canEdit(req.user, existing, mt?.mt_id) : canWrite(req.user),
    });
  } catch (error) {
    console.error("[evaluation] prepare failed:", error);
    return res.status(500).json({ success: false, message: "Could not open that report" });
  }
};

/** Keep only the four criteria the form defines, and only true/false. */
const cleanDaily = (raw, week, customLabel) => {
  const daily = {};
  const keys = [...DAILY_CRITERIA.map((item) => item.key), ...(customLabel ? ["custom"] : [])];

  for (const key of keys) {
    const row = raw?.[key] || {};
    daily[key] = {};
    for (const day of week.days) {
      // Absent is false, not undefined: an unticked box is an answer of "no",
      // and a missing key would render as an empty cell that reads as neither.
      daily[key][day.key] = row[day.key] === true || row[day.key] === "true";
    }
  }

  return daily;
};

/** A whole number a person typed, or null. Never NaN, never negative. */
const countFrom = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.floor(number);
};

const textFrom = (value, max) => {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
};

/**
 * Save a report, as a draft or submitted.
 *
 * One row per trainer per week, so this creates or updates rather than
 * inserting - and the unique index is what makes that safe when two tabs save
 * at once.
 */
exports.save = async (req, res) => {
  try {
    const mt = await masterTrainerFor(req.user);
    if (!mt || !canWrite(req.user)) {
      return res
        .status(403)
        .json({ success: false, message: "Only a Master Trainer can write a report" });
    }

    const t_id = Number(req.body?.t_id);
    if (!Number.isInteger(t_id) || t_id <= 0) {
      return res.status(400).json({ success: false, message: "Which trainer?" });
    }

    const { week, error } = resolveWeek(req.body?.week_key);
    if (error) return res.status(400).json({ success: false, message: error });

    const trainer = await Trainer.findOne({ where: { t_id }, raw: true });
    if (!trainer) return res.status(404).json({ success: false, message: "No such trainer" });

    if (!ownsTrainer(mt.mt_id, trainer)) {
      return res
        .status(403)
        .json({ success: false, message: "That trainer does not report to you" });
    }

    const submitting = req.body?.status === "submitted";

    const existing = await WeeklyEvaluation.findOne({
      where: { t_id, we_week_key: week.key },
    });

    // Submitted is final. Saying so is better than silently discarding the
    // work someone just typed into a form that looked editable.
    if (existing && existing.we_status === "submitted") {
      return res.status(409).json({
        success: false,
        message: "That report was already submitted and cannot be changed",
      });
    }

    const customLabel = textFrom(req.body?.custom_label, 120);

    const quality = QUALITY_GRADES.includes(req.body?.quality) ? req.body.quality : null;
    const feedback = ["Yes", "No"].includes(req.body?.feedback_submission)
      ? req.body.feedback_submission
      : null;

    // Submitting means signing it. The parts a person has to answer are
    // required at that point, and not before - a draft is allowed to be
    // half-finished, that is what it is for.
    if (submitting) {
      const missing = [];
      if (!quality) missing.push("Grading of Training Quality");
      if (!feedback) missing.push("Trainees' Feedback Submission");
      if (missing.length) {
        return res.status(400).json({
          success: false,
          message: `Before submitting, please answer: ${missing.join(", ")}`,
        });
      }
    }

    // The classes and the computed figures as they stand now, kept with the
    // report so it can be read back years later against data that has moved on.
    const classes = await nameLookup(await classesFor(t_id));
    const auto = await metricsFor(t_id, week);

    const values = {
      t_id,
      mt_id: mt.mt_id,
      we_week_key: week.key,
      we_week_start: week.start,
      we_week_end: week.end,
      we_daily: cleanDaily(req.body?.daily, week, customLabel),
      we_custom_label: customLabel,
      we_assignments: countFrom(req.body?.assignments),
      we_quizzes: countFrom(req.body?.quizzes),
      we_quality: quality,
      we_mt_visit_date: textFrom(req.body?.mt_visit_date, 10),
      we_enrolled_start: countFrom(req.body?.enrolled_start),
      we_dropouts: countFrom(req.body?.dropouts),
      we_new_enrolled: countFrom(req.body?.new_enrolled),
      we_on_leave: countFrom(req.body?.on_leave),
      we_feedback_submission: feedback,
      we_other_tasks: textFrom(req.body?.other_tasks, 4000),
      we_remarks: textFrom(req.body?.remarks, 4000),
      we_classes: classes,
      we_auto: auto,
      we_status: submitting ? "submitted" : "draft",
      we_submitted_on: submitting ? new Date() : null,
    };

    const report = existing
      ? await existing.update(values)
      : await WeeklyEvaluation.create(values);

    console.log(
      `[evaluation] ${submitting ? "submitted" : "saved a draft of"} the ${week.key} report ` +
        `for trainer ${t_id} by mt ${mt.mt_id}`
    );

    return res.json({
      success: true,
      message: submitting ? "Report submitted" : "Draft saved",
      report,
    });
  } catch (error) {
    // The unique index doing its job: two tabs submitting the same report.
    if (error?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "A report for that trainer and week already exists",
      });
    }

    console.error("[evaluation] save failed:", error);
    return res.status(500).json({ success: false, message: "Could not save that report" });
  }
};

/** Every report written about one trainer, newest week first. */
exports.history = async (req, res) => {
  try {
    const mt = await masterTrainerFor(req.user);
    const scope = readScope(req.user, mt?.mt_id);
    if (!scope) return res.status(403).json({ success: false, message: "Not for you" });

    const t_id = Number(req.query.t_id);
    if (!Number.isInteger(t_id) || t_id <= 0) {
      return res.status(400).json({ success: false, message: "Which trainer?" });
    }

    const reports = await WeeklyEvaluation.findAll({
      where: {
        ...scope,
        t_id,
        // A draft is the author's own working copy. An admin reading the
        // history should see what was signed off, not what is half-typed.
        ...(isViewer(req.user) ? { we_status: "submitted" } : {}),
      },
      order: [["we_week_start", "DESC"]],
    });

    return res.json({ success: true, reports });
  } catch (error) {
    console.error("[evaluation] history failed:", error);
    return res.status(500).json({ success: false, message: "Could not load that history" });
  }
};

/** One report, in full. */
exports.show = async (req, res) => {
  try {
    const mt = await masterTrainerFor(req.user);
    const scope = readScope(req.user, mt?.mt_id);
    if (!scope) return res.status(403).json({ success: false, message: "Not for you" });

    const report = await WeeklyEvaluation.findOne({
      where: { ...scope, we_id: Number(req.params.id) || 0 },
      include: [
        {
          model: Trainer,
          as: "trainer",
          attributes: ["t_id", "t_cnic"],
          include: [{ model: User, as: "user", attributes: ["user_name", "user_email"] }],
        },
      ],
    });

    if (!report) return res.status(404).json({ success: false, message: "No such report" });

    if (isViewer(req.user) && report.we_status !== "submitted") {
      return res.status(404).json({ success: false, message: "No such report" });
    }

    return res.json({
      success: true,
      report,
      criteria: DAILY_CRITERIA,
      week: weekFromKey(report.we_week_key) || weekOf(new Date(report.we_week_start)),
      editable: canEdit(req.user, report, mt?.mt_id),
    });
  } catch (error) {
    console.error("[evaluation] show failed:", error);
    return res.status(500).json({ success: false, message: "Could not load that report" });
  }
};

/**
 * Every trainer in the programme for one week, reported on or not.
 *
 * The admin view, and the missing rows are the point of it. A list of what was
 * submitted answers "what do we have"; this answers "who has not done it yet",
 * which is the question that changes anyone's behaviour.
 */
exports.overview = async (req, res) => {
  try {
    if (!isViewer(req.user)) {
      return res.status(403).json({ success: false, message: "Not for you" });
    }

    const { week, error } = resolveWeek(req.query.week);
    if (error) return res.status(400).json({ success: false, message: error });

    const trainers = await Trainer.findAll({
      attributes: ["t_id", "mt_id", "t_cnic"],
      include: [{ model: User, as: "user", attributes: ["user_name"] }],
    });

    const [reports, masterTrainers, allocations] = await Promise.all([
      WeeklyEvaluation.findAll({
        where: { we_week_key: week.key },
        attributes: ["we_id", "t_id", "mt_id", "we_status", "we_submitted_on", "we_quality"],
        raw: true,
      }),
      MasterTrainer.findAll({
        attributes: ["mt_id", "user_id"],
        include: [{ model: User, as: "user", attributes: ["user_name"] }],
      }),
      TrainerCenterAllocation.findAll({ attributes: ["t_id"], raw: true }),
    ]);

    const reportBy = Object.fromEntries(reports.map((row) => [row.t_id, row]));
    const mtBy = Object.fromEntries(
      masterTrainers.map((row) => [row.mt_id, row.user?.user_name || `MT ${row.mt_id}`])
    );

    // A trainer with no classes has nothing to be evaluated on, and counting
    // them as missing would make the number meaningless.
    const teaching = new Set(allocations.map((row) => row.t_id));

    const rows = trainers.map((trainer) => {
      const report = reportBy[trainer.t_id];
      return {
        t_id: trainer.t_id,
        name: trainer.user?.user_name || `Trainer ${trainer.t_id}`,
        master_trainer: trainer.mt_id ? mtBy[trainer.mt_id] || null : null,
        mt_id: trainer.mt_id,
        teaching: teaching.has(trainer.t_id),
        status: report ? report.we_status : "missing",
        we_id: report?.we_id || null,
        quality: report?.we_quality || null,
        submitted_on: report?.we_submitted_on || null,
      };
    });

    const active = rows.filter((row) => row.teaching);

    // Weeks before this module took over were filed on paper. Their reports
    // are not missing, they are elsewhere - counting them as outstanding would
    // put a permanent red number on the screen that nobody can ever clear.
    const chased = isChased(week);

    return res.json({
      success: true,
      week,
      weeks: recentWeeks(12),
      chased,
      startWeek: START_WEEK,
      rows,
      summary: {
        teaching: active.length,
        submitted: active.filter((row) => row.status === "submitted").length,
        draft: active.filter((row) => row.status === "draft").length,
        missing: chased ? active.filter((row) => row.status === "missing").length : 0,
      },
    });
  } catch (error) {
    console.error("[evaluation] overview failed:", error);
    return res.status(500).json({ success: false, message: "Could not load the overview" });
  }
};

/**
 * What this Master Trainer still owes, for the dashboard.
 *
 * Deliberately small and cheap: it runs on every dashboard load, and a
 * reminder that slows the dashboard down is a reminder people learn to
 * resent.
 */
exports.pending = async (req, res) => {
  try {
    const mt = await masterTrainerFor(req.user);
    if (!mt) return res.json({ success: true, pending: [] });

    const trainers = await Trainer.findAll({
      where: { mt_id: mt.mt_id },
      attributes: ["t_id"],
      raw: true,
    });

    const allocations = await TrainerCenterAllocation.findAll({
      where: { t_id: trainers.map((row) => row.t_id) },
      attributes: ["t_id"],
      raw: true,
    });

    // Only trainers actually teaching. Nobody should be chased for a report on
    // a trainer with no class this term.
    const teaching = [...new Set(allocations.map((row) => row.t_id))];
    if (teaching.length === 0) return res.json({ success: true, pending: [] });

    // This week and the two before it, and never earlier than the week this
    // module took over - those were filed on paper and chasing them would be
    // asking for the same work twice. Further back than three weeks a reminder
    // is no longer a nudge but a backlog, and the module's own list is the
    // right place to work through one.
    const weeks = recentWeeks(3).filter((week) => isChased(week));
    if (weeks.length === 0) return res.json({ success: true, pending: [] });

    const submitted = await WeeklyEvaluation.findAll({
      where: {
        t_id: teaching,
        we_week_key: weeks.map((entry) => entry.key),
        we_status: "submitted",
      },
      attributes: ["t_id", "we_week_key"],
      raw: true,
    });

    const done = new Set(submitted.map((row) => `${row.t_id}:${row.we_week_key}`));

    const pending = weeks
      .map((week) => ({
        week,
        outstanding: teaching.filter((t_id) => !done.has(`${t_id}:${week.key}`)).length,
      }))
      .filter((entry) => entry.outstanding > 0);

    return res.json({ success: true, pending, trainers: teaching.length });
  } catch (error) {
    console.error("[evaluation] pending failed:", error);
    // A broken reminder must not break the dashboard around it.
    return res.json({ success: true, pending: [] });
  }
};

exports._internals = { cleanDaily, countFrom, textFrom, resolveWeek };
