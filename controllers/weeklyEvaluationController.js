const { Op } = require("sequelize");
const WeeklyEvaluation = require("../models/weeklyEvaluationModel");
const Trainer = require("../models/trainersModel");
const MasterTrainer = require("../models/masterTrainersModel");
const User = require("../models/userModel");
const Center = require("../models/center");
const Course = require("../models/course");
const TrainingBatch = require("../models/trainingBatcheModel");
const TrainerCenterAllocation = require("../models/trainersCenterAllocationModel");
const { metricsFor } = require("../utils/evaluationMetrics");
const {
  trainersForCourse,
  classesInBatch,
  teachingWindow,
  classesActiveIn,
  weeksInWindow,
  isInWindow,
} = require("../utils/evaluationScope");
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
  teachesCourse,
  canEdit,
  isMasterTrainer,
  isViewer,
} = require("../utils/evaluationAccess");

/**
 * The weekly M&E report on trainer performance.
 *
 * A Master Trainer fills one in per trainer per batch per week; admins read
 * them and, more importantly, see which are missing. The paper form is the
 * contract - utils/evaluationWeek.js holds its criteria and grades so the
 * form, the API and the tests cannot drift apart.
 *
 * THREE THINGS DECIDE WHAT ANYONE SEES, and all three live in
 * utils/evaluationScope.js:
 *
 *   THE COURSE links a Master Trainer to a trainer. An MT owns a course and
 *   evaluates whoever is teaching it - not whoever has their id in a column.
 *
 *   THE BATCH scopes everything. The module is read one batch at a time, and a
 *   trainer's other batch is a different report with different students.
 *
 *   THE CENTRE'S DATES decide which weeks exist. Each centre has its own start
 *   and end even inside one batch, so the weeks on offer are the widest span
 *   across a trainer's centres - and the form marks which of their classes had
 *   actually started in the week being reported on.
 *
 * A trainer with no allocation in the batch never appears at all. There is
 * nothing to evaluate, and a greyed-out row saying so is clutter on a list
 * whose whole job is to show what is outstanding.
 *
 * Everything countable is offered pre-filled from the LMS and stays editable.
 * See utils/evaluationMetrics.js for what can honestly be counted and what
 * cannot.
 */

/** The batch a request is about. Required: nothing here is batch-agnostic. */
const resolveBatch = (raw) => {
  const tb_id = Number(raw);
  return Number.isInteger(tb_id) && tb_id > 0 ? tb_id : null;
};

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

/**
 * The trainers a Master Trainer evaluates in one batch.
 *
 * Found through the ALLOCATION, by course. That one query answers all three
 * questions at once - teaching the MT's course, in this batch, with a class at
 * all - so a trainer with nothing allocated cannot appear and does not need
 * filtering out later.
 */
const trainersUnder = async (courseId, tb_id) => {
  const allocated = await trainersForCourse(courseId, tb_id);
  if (allocated.length === 0) return [];

  const trainers = await Trainer.findAll({
    where: { t_id: allocated.map((entry) => entry.t_id) },
    attributes: ["t_id", "user_id", "t_cnic", "t_course_id"],
    include: [{ model: User, as: "user", attributes: ["user_name", "user_email"] }],
  });

  const rowBy = Object.fromEntries(trainers.map((row) => [row.t_id, row]));

  return Promise.all(
    allocated.map(async (entry) => {
      const trainer = rowBy[entry.t_id];
      return {
        t_id: entry.t_id,
        name: trainer?.user?.user_name || `Trainer ${entry.t_id}`,
        email: trainer?.user?.user_email || null,
        cnic: trainer?.t_cnic || "",
        classes: await nameLookup(entry.classes),
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

    const tb_id = resolveBatch(req.query.tb_id);
    if (!tb_id) {
      return res.status(400).json({ success: false, message: "Choose a batch first" });
    }

    const trainers = await trainersUnder(mt.mt_course_id, tb_id);

    // The weeks come from the centres these trainers actually teach at in this
    // batch, so a batch that has not started offers nothing rather than every
    // week since January.
    const centreIds = [
      ...new Set(trainers.flatMap((entry) => entry.classes.map((c) => c.center_id))),
    ];
    const window = await teachingWindow(centreIds, tb_id);
    const weeks = weeksInWindow(window);

    // Default to the most recent week of the batch, which is the one being
    // reported on - not "this week", which may be after the batch ended.
    const requested = req.query.week ? resolveWeek(req.query.week) : { week: weeks[0] || weekOf() };
    if (requested.error) {
      return res.status(400).json({ success: false, message: requested.error });
    }
    const week = requested.week;

    const reports = trainers.length
      ? await WeeklyEvaluation.findAll({
          where: {
            we_week_key: week.key,
            tb_id,
            t_id: trainers.map((entry) => entry.t_id),
          },
          attributes: ["we_id", "t_id", "we_status", "we_submitted_on"],
          raw: true,
        })
      : [];

    const reportBy = Object.fromEntries(reports.map((row) => [row.t_id, row]));

    return res.json({
      success: true,
      week,
      weeks,
      window,
      inWindow: isInWindow(week, window),
      trainers: trainers.map((trainer) => ({
        ...trainer,
        // Which of this trainer's centres had actually started in this week.
        classes: classesActiveIn(trainer.classes, week, window),
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

    const tb_id = resolveBatch(req.query.tb_id);
    if (!tb_id) {
      return res.status(400).json({ success: false, message: "Choose a batch first" });
    }

    const trainer = await Trainer.findOne({
      where: { t_id },
      include: [{ model: User, as: "user", attributes: ["user_name", "user_email"] }],
    });
    if (!trainer) {
      return res.status(404).json({ success: false, message: "No such trainer" });
    }

    // The classes this trainer teaches in this batch. They are also the proof
    // of access: a Master Trainer may report on a trainer teaching their
    // course, so the allocation answers the question rather than a column
    // somebody may or may not have filled in.
    const classes = await classesInBatch(t_id, tb_id);

    if (!isViewer(req.user)) {
      if (!mt) {
        return res.status(403).json({ success: false, message: "Master Trainers only" });
      }
      if (!teachesCourse(mt.mt_course_id, classes)) {
        return res.status(403).json({
          success: false,
          message: "That trainer is not teaching your course in this batch",
        });
      }
    }

    if (classes.length === 0) {
      return res.status(404).json({
        success: false,
        message: "That trainer has no class in this batch",
      });
    }

    const window = await teachingWindow(
      classes.map((entry) => entry.center_id),
      tb_id
    );
    const weeks = weeksInWindow(window);

    const requested = req.query.week ? resolveWeek(req.query.week) : { week: weeks[0] || weekOf() };
    if (requested.error) {
      return res.status(400).json({ success: false, message: requested.error });
    }
    const week = requested.week;

    const existing = await WeeklyEvaluation.findOne({
      where: { t_id, tb_id, we_week_key: week.key },
    });

    // A submitted report shows what it recorded, not what the numbers say
    // today - the data moves on and the report must not.
    const metrics =
      existing && existing.we_status === "submitted"
        ? null
        : await metricsFor(t_id, week, tb_id);

    const named = existing?.we_classes?.length
      ? existing.we_classes
      : await nameLookup(classes);

    return res.json({
      success: true,
      week,
      weeks,
      window,
      inWindow: isInWindow(week, window),
      criteria: DAILY_CRITERIA,
      grades: QUALITY_GRADES,
      trainer: {
        t_id: trainer.t_id,
        name: trainer.user?.user_name || `Trainer ${trainer.t_id}`,
        email: trainer.user?.user_email || null,
        cnic: trainer.t_cnic,
      },
      // Marked with which centres had actually started in this week, so a
      // class that had not begun is visible as such rather than silently
      // included in a grade.
      classes: classesActiveIn(named, week, window),
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

    const tb_id = resolveBatch(req.body?.tb_id);
    if (!tb_id) {
      return res.status(400).json({ success: false, message: "Which batch?" });
    }

    const { week, error } = resolveWeek(req.body?.week_key);
    if (error) return res.status(400).json({ success: false, message: error });

    const trainer = await Trainer.findOne({ where: { t_id }, raw: true });
    if (!trainer) return res.status(404).json({ success: false, message: "No such trainer" });

    // Access and scope from the same source: the allocation. Checked here as
    // well as in prepare, because a POST does not have to have come from a
    // form this server rendered.
    const classes = await classesInBatch(t_id, tb_id);

    if (!teachesCourse(mt.mt_course_id, classes)) {
      return res.status(403).json({
        success: false,
        message: "That trainer is not teaching your course in this batch",
      });
    }

    // A week the centres were not teaching in is not a week to report on. The
    // form does not offer one; a request can still ask for it.
    const window = await teachingWindow(
      classes.map((entry) => entry.center_id),
      tb_id
    );
    if (window && !isInWindow(week, window)) {
      return res.status(400).json({
        success: false,
        message: `This batch ran from ${window.start} to ${window.end}. That week is outside it.`,
      });
    }

    const submitting = req.body?.status === "submitted";

    const existing = await WeeklyEvaluation.findOne({
      where: { t_id, tb_id, we_week_key: week.key },
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
    const named = await nameLookup(classes);
    const auto = await metricsFor(t_id, week, tb_id);

    const values = {
      t_id,
      mt_id: mt.mt_id,
      tb_id,
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
      we_classes: classesActiveIn(named, week, window),
      we_auto: auto,
      we_status: submitting ? "submitted" : "draft",
      we_submitted_on: submitting ? new Date() : null,
    };

    const report = existing
      ? await existing.update(values)
      : await WeeklyEvaluation.create(values);

    console.log(
      `[evaluation] ${submitting ? "submitted" : "saved a draft of"} the ${week.key} report ` +
        `for trainer ${t_id} in batch ${tb_id} by mt ${mt.mt_id}`
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

    // Optional. Without a batch this is every report ever written about the
    // trainer, which is what someone reviewing a person over time wants.
    const tb_id = resolveBatch(req.query.tb_id);

    const reports = await WeeklyEvaluation.findAll({
      where: {
        ...scope,
        t_id,
        ...(tb_id ? { tb_id } : {}),
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

    const tb_id = resolveBatch(req.query.tb_id);
    if (!tb_id) {
      return res.status(400).json({ success: false, message: "Choose a batch first" });
    }

    // Only trainers with a class in this batch. A trainer without one has
    // nothing to be evaluated on and never appears - which is also what keeps
    // the outstanding count meaningful.
    const allocations = await TrainerCenterAllocation.findAll({
      where: { tb_id },
      attributes: ["t_id", "center_id", "course_id"],
      raw: true,
    });

    if (allocations.length === 0) {
      return res.json({
        success: true,
        week: weekOf(),
        weeks: [],
        window: null,
        rows: [],
        summary: { teaching: 0, submitted: 0, draft: 0, missing: 0 },
        chased: false,
        startWeek: START_WEEK,
      });
    }

    const window = await teachingWindow(
      [...new Set(allocations.map((row) => row.center_id))],
      tb_id
    );
    const weeks = weeksInWindow(window);

    const requested = req.query.week ? resolveWeek(req.query.week) : { week: weeks[0] || weekOf() };
    if (requested.error) {
      return res.status(400).json({ success: false, message: requested.error });
    }
    const week = requested.week;

    const teachingIds = [...new Set(allocations.map((row) => row.t_id))];

    const trainers = await Trainer.findAll({
      where: { t_id: teachingIds },
      attributes: ["t_id", "mt_id", "t_cnic", "t_course_id"],
      include: [{ model: User, as: "user", attributes: ["user_name"] }],
    });

    const [reports, masterTrainers] = await Promise.all([
      WeeklyEvaluation.findAll({
        where: { we_week_key: week.key, tb_id },
        attributes: ["we_id", "t_id", "mt_id", "we_status", "we_submitted_on", "we_quality"],
        raw: true,
      }),
      MasterTrainer.findAll({
        attributes: ["mt_id", "user_id", "mt_course_id"],
        include: [{ model: User, as: "user", attributes: ["user_name"] }],
      }),
    ]);

    const reportBy = Object.fromEntries(reports.map((row) => [row.t_id, row]));

    // The Master Trainer responsible is the one who owns the course being
    // taught, which is how the whole module is scoped - not trainers.mt_id.
    const mtByCourse = {};
    for (const row of masterTrainers) {
      mtByCourse[row.mt_course_id] = row.user?.user_name || `MT ${row.mt_id}`;
    }

    // Which course each trainer teaches IN THIS BATCH, which is what decides
    // who is responsible for their report.
    const courseByTrainer = {};
    for (const row of allocations) courseByTrainer[row.t_id] = row.course_id;

    const rows = trainers.map((trainer) => {
      const report = reportBy[trainer.t_id];
      const courseId = courseByTrainer[trainer.t_id];

      return {
        t_id: trainer.t_id,
        name: trainer.user?.user_name || `Trainer ${trainer.t_id}`,
        master_trainer: mtByCourse[courseId] || null,
        mt_id: trainer.mt_id,
        teaching: true,
        status: report ? report.we_status : "missing",
        we_id: report?.we_id || null,
        quality: report?.we_quality || null,
        submitted_on: report?.we_submitted_on || null,
      };
    });

    // Weeks before this module took over were filed on paper, and a week the
    // batch was not running is not owed at all. Either way, counting them as
    // outstanding would put a permanent red number on the screen that nobody
    // can ever clear.
    const chased = isChased(week) && isInWindow(week, window);

    return res.json({
      success: true,
      week,
      weeks,
      window,
      chased,
      startWeek: START_WEEK,
      rows,
      summary: {
        teaching: rows.length,
        submitted: rows.filter((row) => row.status === "submitted").length,
        draft: rows.filter((row) => row.status === "draft").length,
        missing: chased ? rows.filter((row) => row.status === "missing").length : 0,
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

    // Every batch this Master Trainer's course is being taught in. The
    // reminder spans batches deliberately: an MT running two at once is owed
    // reports for both, and a nudge that only knew about one would be wrong
    // in the quietest possible way.
    const allocations = await TrainerCenterAllocation.findAll({
      where: { course_id: mt.mt_course_id },
      attributes: ["t_id", "tb_id", "center_id"],
      raw: true,
    });

    if (allocations.length === 0) return res.json({ success: true, pending: [] });

    const byBatch = new Map();
    for (const row of allocations) {
      if (!byBatch.has(row.tb_id)) byBatch.set(row.tb_id, { trainers: new Set(), centres: new Set() });
      byBatch.get(row.tb_id).trainers.add(row.t_id);
      byBatch.get(row.tb_id).centres.add(row.center_id);
    }

    // This week and the two before it. Further back a reminder is no longer a
    // nudge but a backlog, and the module's own list is where you work through
    // one. Never earlier than the week this module took over either - those
    // weeks were filed on paper.
    const candidateWeeks = recentWeeks(3).filter((week) => isChased(week));
    if (candidateWeeks.length === 0) return res.json({ success: true, pending: [] });

    const outstandingByWeek = new Map();
    let trainerCount = 0;

    for (const [tb_id, entry] of byBatch) {
      const window = await teachingWindow([...entry.centres], tb_id);

      // A batch that has finished, or has not started, is not owed anything.
      const weeks = candidateWeeks.filter((week) => isInWindow(week, window));
      if (weeks.length === 0) continue;

      const trainers = [...entry.trainers];
      trainerCount += trainers.length;

      const submitted = await WeeklyEvaluation.findAll({
        where: {
          tb_id,
          t_id: trainers,
          we_week_key: weeks.map((week) => week.key),
          we_status: "submitted",
        },
        attributes: ["t_id", "we_week_key"],
        raw: true,
      });

      const done = new Set(submitted.map((row) => `${row.t_id}:${row.we_week_key}`));

      for (const week of weeks) {
        const owed = trainers.filter((t_id) => !done.has(`${t_id}:${week.key}`)).length;
        if (owed === 0) continue;

        const current = outstandingByWeek.get(week.key) || { week, outstanding: 0 };
        current.outstanding += owed;
        outstandingByWeek.set(week.key, current);
      }
    }

    // Newest first, matching the order the weeks were generated in.
    const pending = candidateWeeks
      .map((week) => outstandingByWeek.get(week.key))
      .filter(Boolean);

    return res.json({ success: true, pending, trainers: trainerCount });
  } catch (error) {
    console.error("[evaluation] pending failed:", error);
    // A broken reminder must not break the dashboard around it.
    return res.json({ success: true, pending: [] });
  }
};

exports._internals = { cleanDaily, countFrom, textFrom, resolveWeek };
