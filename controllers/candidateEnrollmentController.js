const { sequelize } = require("../config/db");
const Candidate = require("../models/CandidateModel");
const Student = require("../models/studentModel");
const User = require("../models/userModel");
const Center = require("../models/center");
const Course = require("../models/course");
const TrainingBatch = require("../models/trainingBatcheModel");
const { Op } = require("sequelize");
const { sendEmail, escapeHtml } = require("../servec/emailConfig");
const { enrolmentConfirmed } = require("../servec/emailTemplates");
const { studentContactConflicts } = require("../utils/contactUniqueness");
const { profileFromCandidate } = require("../utils/candidateProfile");

/**
 * Required lazily: this controller is loaded by scripts and tests that have
 * no database, and the outbox pulls in a model.
 */
let outboxModule = null;
const outbox = () => {
  if (!outboxModule) {
    // eslint-disable-next-line global-require
    outboxModule = require("../utils/emailOutbox");
  }
  return outboxModule;
};
const { findScheduleFor } = require("./classScheduleController");
const {
  parseCnicList,
  buildCnicTemplateCsv,
  normaliseCnic,
  formatCnic,
  cnicVariants,
} = require("../utils/cnicListParser");

/**
 * Enrol a recommended candidate as a student.
 *
 * Mirrors the roll-number scheme already used by the bulk importer
 * (Frontend/src/utils/rollNumber.ts): D + B<batch> + 7 random digits + a
 * weighted checksum digit, e.g. DB8-6273256-5. Generating it server-side means
 * uniqueness can actually be enforced against the database, which the
 * client-side version could not do.
 */

const generateRandomDigits = (length) => {
  let result = "";
  for (let index = 0; index < length; index += 1) {
    result += Math.floor(Math.random() * 10);
  }
  return result;
};

/** Sum of each digit multiplied by its 1-based position, mod 10. */
const calculateChecksum = (digits) =>
  digits
    .split("")
    .map(Number)
    .reduce((total, digit, index) => total + digit * (index + 1), 0) % 10;

const buildRollNumber = (batchId) => {
  const random = generateRandomDigits(7);
  return `DB${batchId}-${random}-${calculateChecksum(random)}`;
};

/** Generate a roll number that is not already taken. */
const generateUniqueRollNumber = async (batchId, transaction) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidateRoll = buildRollNumber(batchId);
    const clash = await Student.findOne({
      where: { std_rollno: candidateRoll },
      attributes: ["std_id"],
      transaction,
    });
    if (!clash) return candidateRoll;
  }
  throw new Error("Could not generate a unique roll number after 20 attempts");
};

/** Matches the existing convention: local part of the email plus "@". */
const buildUsername = (email) => {
  const clean = String(email || "").trim();
  if (!clean.includes("@")) return clean;
  return `${clean.split("@")[0]}@`;
};

/**
 * Details shown in the confirmation popup before enrolling.
 * GET /api/candidateRoutes/enrollment-preview/:cand_id
 */
exports.getEnrollmentPreview = async (req, res) => {
  try {
    const { cand_id } = req.params;

    const candidate = await Candidate.findByPk(cand_id, {
      include: [
        { model: Course, as: "courses", attributes: ["course_id", "course_name", "course_full_name"] },
        { model: Center, as: "centers", attributes: ["center_id", "center_name"] },
        { model: TrainingBatch, as: "training_batches", attributes: ["tb_id", "tb_name"] },
      ],
    });

    if (!candidate) {
      return res.status(404).json({ success: false, message: "Candidate not found" });
    }

    const alreadyEnrolled = await Student.findOne({
      where: { std_cnic: candidate.cand_cnic, tb_id: candidate.tb_id },
      attributes: ["std_id", "std_rollno"],
      raw: true,
    });

    return res.json({
      success: true,
      candidate: {
        cand_id: candidate.cand_id,
        name: candidate.cand_name,
        father_name: candidate.cand_fathername,
        cnic: candidate.cand_cnic,
        email: candidate.cand_email,
        phone: candidate.cand_phone,
        gender: candidate.cand_gender,
        qualification: candidate.cand_degree_level,
        district: candidate.cand_local_domicile,
        recommended: candidate.recommended,
        admission_status: candidate.cand_admission_status,
        is_uob_student: candidate.is_uob_student,
      },
      enrollment: {
        center_id: candidate.centers?.center_id ?? candidate.center_id,
        center_name: candidate.centers?.center_name || "",
        course_id: candidate.courses?.course_id ?? candidate.course_id,
        course_name:
          candidate.courses?.course_full_name || candidate.courses?.course_name || "",
        tb_id: candidate.training_batches?.tb_id ?? candidate.tb_id,
        batch_name: candidate.training_batches?.tb_name || "",
      },
      alreadyEnrolled: alreadyEnrolled
        ? { std_id: alreadyEnrolled.std_id, std_rollno: alreadyEnrolled.std_rollno }
        : null,
      eligible: candidate.recommended === "Yes" && !alreadyEnrolled,
    });
  } catch (error) {
    console.error("Enrollment preview error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error building enrollment preview" });
  }
};

/**
 * Enrol the candidate.
 * POST /api/candidateRoutes/enroll/:cand_id
 */
/**
 * Why a candidate cannot be enrolled right now.
 *
 * One definition, shared by the single enrolment endpoint and the bulk
 * upload, so the two cannot drift apart on who is eligible.
 *
 * `requireRecommendation` is the one deliberate difference between them.
 * The Enroll button acts on a row in a table, where the recommendation is
 * the only evidence the panel has decided anything - so it is enforced.
 * An uploaded CNIC list IS that decision, written down by the panel after
 * the fact, and refusing a name on it because the interview screen was
 * never updated would be the tool arguing with the people using it.
 *
 * Everything else below stays enforced either way. Those are not policy
 * about who deserves a place; they are facts about whether the records can
 * be created at all.
 *
 * Returns null when the candidate can be enrolled.
 */
const findBlocker = async (
  candidate,
  transaction,
  { requireRecommendation = true } = {}
) => {
  if (requireRecommendation && candidate.recommended !== "Yes") {
    return {
      status: "not_recommended",
      message: "Only candidates recommended at interview can be enrolled",
    };
  }

  // Guard against double enrolment from a double-click, a stale list, or the
  // same CNIC appearing in two uploaded files.
  const existingStudent = await Student.findOne({
    where: { std_cnic: candidate.cand_cnic, tb_id: candidate.tb_id },
    attributes: ["std_id", "std_rollno"],
    transaction,
  });
  if (existingStudent) {
    return {
      status: "already_enrolled",
      message: `Already enrolled (roll no ${existingStudent.std_rollno})`,
      rollNumber: existingStudent.std_rollno,
    };
  }

  const email = String(candidate.cand_email || "").trim().toLowerCase();
  if (!email) {
    return { status: "no_email", message: "Candidate has no email address" };
  }

  // The account table's user_email is UNIQUE across everybody - trainers and
  // administrators included - so this has to stay broader than "enrolled
  // students". Without it the INSERT fails on the constraint and the admin
  // gets a database error instead of a sentence.
  const existingUser = await User.findOne({
    where: { user_email: email },
    attributes: ["user_id"],
    transaction,
  });
  if (existingUser) {
    return {
      status: "email_taken",
      message: `A user account already exists with ${email}`,
    };
  }

  // The phone was never checked at enrolment at all, so two students could
  // end up sharing a number with nothing to show it had happened. Scoped to
  // people already enrolled: this candidate's own application holds these
  // details, so consulting applications would make every enrolment collide
  // with itself.
  const { conflicts } = await studentContactConflicts({
    phone: candidate.cand_phone,
  });
  if (conflicts.length > 0) {
    return {
      status: "phone_taken",
      message: `Another enrolled student already has the phone number ${candidate.cand_phone}`,
    };
  }

  const schedule = await findScheduleFor(
    candidate.center_id,
    candidate.course_id,
    candidate.tb_id,
    transaction
  );
  if (!schedule) {
    return {
      status: "no_schedule",
      message:
        "No class start date and timings have been set for this centre and course. Set them under Class Schedule, then enrol.",
    };
  }

  return null;
};

/**
 * Create the user and student rows for one candidate.
 *
 * Assumes findBlocker has already passed. Does NOT commit - the caller owns
 * the transaction, because the bulk path gives each candidate its own so one
 * bad record cannot roll back two hundred good ones.
 */
const createStudentFromCandidate = async (candidate, overrides, transaction) => {
  /**
   * The applicant's own details, through the shared mapping rather than read
   * off the candidate inline - scripts/backfill-student-details.js repairs old
   * rows with the same one, and two copies of a mapping drift apart.
   */
  const inherited = profileFromCandidate(candidate);

  const centerId = overrides.center_id || candidate.center_id;
  const courseId = overrides.course_id || candidate.course_id;
  const batchId = overrides.tb_id || candidate.tb_id;
  const email = String(candidate.cand_email || "").trim().toLowerCase();

  const rollNumber =
    String(overrides.std_rollno || "").trim() ||
    (await generateUniqueRollNumber(batchId, transaction));

  // Password is left blank on purpose: students set their own on first
  // login, exactly as the existing student registration flow does.
  const newUser = await User.create(
    {
      user_name: String(candidate.cand_name || "").trim(),
      user_email: email,
      user_password: "",
      user_username: buildUsername(email),
      user_profile_photo: candidate.cand_photo || null,
      user_type: "student",
      user_status: 1,
    },
    { transaction }
  );

  const newStudent = await Student.create(
    {
      user_id: newUser.user_id,
      std_rollno: rollNumber,
      std_cnic: candidate.cand_cnic,
      std_fathername: candidate.cand_fathername,
      std_gender: candidate.cand_gender,
      // NOT NULL columns, so a candidate with nothing to give still needs a
      // value; `inherited` supplies it whenever there is one to supply.
      std_qualification: "",
      std_district: "",
      ...inherited,
      std_phone: candidate.cand_phone,
      course_id: courseId,
      center_id: centerId,
      tb_id: batchId,
      dark_mode: 0,
      special_case: 0,
      special_case_comments: "",
      std_added_on: new Date().toISOString().split("T")[0],
      std_lms_status: 1,
      std_forum_status: 1,
    },
    { transaction }
  );

  return { newUser, newStudent, rollNumber, centerId, courseId, batchId, email };
};

/**
 * The welcome email: congratulations, and when to turn up.
 *
 * Fire-and-forget. Mail must never be able to undo an enrolment that is
 * already committed, so every failure in here is swallowed and logged.
 */
const sendWelcomeEmail = async (
  candidate,
  rollNumber,
  centerId,
  courseId,
  email,
  batchId,
  { queue = false } = {}
) => {
  try {
    const [center, course, schedule] = await Promise.all([
      Center.findByPk(centerId, { attributes: ["center_name"] }),
      Course.findByPk(courseId, { attributes: ["course_name", "course_full_name"] }),
      findScheduleFor(centerId, courseId, batchId),
    ]);

    if (!schedule) {
      // findBlocker proved one existed moments ago, so this means it was
      // deleted in between. The enrolment is already committed and the email
      // must carry a real start date, so the only honest thing is to say so
      // loudly and let somebody resend it.
      console.error(
        `[enroll] no class schedule for centre ${centerId} / course ${courseId} / batch ${batchId} - ${email} was enrolled but not emailed`
      );
      return { status: "no_schedule" };
    }

    const courseName = course?.course_full_name || course?.course_name || "";
    const { subject, text, html } = enrolmentConfirmed({
      name: candidate.cand_name,
      rollNumber,
      courseName,
      centerName: center?.center_name || "",
      startDate: schedule.cs_start_date,
      classDays: schedule.cs_class_days,
      startTime: schedule.cs_start_time,
      endTime: schedule.cs_end_time,
      note: schedule.cs_note,
    });

    // Bulk enrolment hands these to the outbox instead of sending inline.
    // Two hundred enrolments would otherwise fire two hundred sends at once
    // - a burst on any mail server - and awaiting them in turn would hold
    // the request open for minutes. Queued, they drain at a steady rate,
    // retry on their own, and can be counted afterwards.
    if (queue) {
      const row = await outbox().enqueue(
        { to: email, subject, text, html },
        "queued by bulk enrolment for paced delivery"
      );
      return { status: row ? "queued" : "failed" };
    }

    // Transactional: a student is waiting on this, and if Brevo has hit its
    // allowance it falls back to the local SMTP server rather than being
    // dropped. sendEmail rather than sendEmailSafe, so the outcome can be
    // reported instead of swallowed - the try/catch below is what keeps a
    // mail failure from touching an enrolment that is already committed.
    const result = await sendEmail({ to: email, subject, text, html });
    return { status: result?.queued ? "queued" : "sent" };
  } catch (error) {
    console.error(
      `[enroll] could not build the welcome email for ${email}:`,
      error?.message || error
    );
    return { status: "failed" };
  }
};

exports.enrollCandidate = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { cand_id } = req.params;

    const candidate = await Candidate.findByPk(cand_id, { transaction });

    if (!candidate) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: "Candidate not found" });
    }

    const blocker = await findBlocker(candidate, transaction);
    if (blocker) {
      await transaction.rollback();
      // 409 for a clash with something that already exists, 400 for a
      // candidate record that is not ready to be enrolled.
      const conflict =
        blocker.status === "already_enrolled" || blocker.status === "email_taken";
      return res
        .status(conflict ? 409 : 400)
        .json({ success: false, message: blocker.message });
    }

    // Admins may override the center/course in the confirmation popup.
    const { newUser, newStudent, rollNumber, centerId, courseId, batchId, email } =
      await createStudentFromCandidate(candidate, req.body, transaction);

    await transaction.commit();

    // Awaited, so the admin is told whether the student actually has their
    // class details yet. It is one email and it cannot throw - every failure
    // inside is caught - so waiting costs a second and buys an honest answer
    // instead of a hopeful one.
    const mail = await sendWelcomeEmail(
      candidate,
      rollNumber,
      centerId,
      courseId,
      email,
      batchId
    );

    console.log(
      `[enroll] candidate ${candidate.cand_id} enrolled as ${rollNumber} by user ${req.user.id} (${req.user.username})`
    );

    return res.status(201).json({
      success: true,
      message:
        mail?.status === "sent"
          ? "Candidate enrolled and sent their class details"
          : mail?.status === "queued"
          ? "Candidate enrolled. Their class details are queued and will arrive shortly."
          : "Candidate enrolled, but their class details could not be emailed - see the server log",
      emailStatus: mail?.status || "unknown",
      student: {
        std_id: newStudent.std_id,
        std_rollno: rollNumber,
        user_id: newUser.user_id,
        name: newUser.user_name,
        email: newUser.user_email,
        center_id: centerId,
        course_id: courseId,
        tb_id: batchId,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Candidate enrollment error:", error);

    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "A student with this roll number, CNIC or email already exists",
      });
    }

    // Say which field the applicant's record fails on. A bare 500 sent the
    // admin to the server log to find out that a gender was spelled in lower
    // case - a question the response could have answered.
    if (error.name === "SequelizeValidationError") {
      const details = (error.errors || [])
        .map((item) => `${item.path}: ${item.message}`)
        .join("; ");
      return res.status(400).json({
        success: false,
        message: `This candidate's record cannot be enrolled as it stands. ${details}`,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error while enrolling candidate",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ---------------------------------------------------------------------------
// Bulk enrolment from an uploaded CNIC list
// ---------------------------------------------------------------------------
//
// An interview panel works from paper and ends with a list of CNIC numbers.
// Enrolling them one row at a time through the table is hundreds of clicks, and
// the mistakes it produces - a row missed, a row done twice - are exactly the
// ones nobody notices until a student cannot log in.
//
// The upload carries CNIC numbers and nothing else. Every other detail comes
// from the candidate record the panel already interviewed, because a
// spreadsheet typed by hand is not a source of truth about somebody's name,
// course or centre - the database is. That also means an operator cannot
// accidentally enrol someone into the wrong course by mistyping a column.

/**
 * Work out what would happen to each CNIC, touching nothing.
 *
 * Scoped to one batch on purpose. The same person may have applied in more than
 * one batch, and "enrol this CNIC" would otherwise be ambiguous in exactly the
 * situation where getting it wrong matters. The admission portal always has a
 * batch selected, so there is nothing extra to ask for.
 */
const planBulkEnrollment = async (entries, tb_id) => {
  if (entries.length === 0) return [];

  // Every spelling of every CNIC, in one query rather than one query per row.
  const lookups = new Map();
  for (const entry of entries) {
    for (const variant of cnicVariants(entry.cnic)) {
      lookups.set(variant, entry.cnic);
    }
  }

  const candidates = await Candidate.findAll({
    where: {
      cand_cnic: { [Op.in]: [...lookups.keys()] },
      tb_id,
    },
  });

  // Candidates in OTHER batches, purely so "not found" can say something more
  // useful than "not found" when the person is plainly in the system.
  const elsewhere = await Candidate.findAll({
    where: {
      cand_cnic: { [Op.in]: [...lookups.keys()] },
      tb_id: { [Op.ne]: tb_id },
    },
    attributes: ["cand_cnic", "tb_id"],
  });

  const byCnic = new Map();
  for (const candidate of candidates) {
    byCnic.set(normaliseCnic(candidate.cand_cnic), candidate);
  }

  const otherBatches = new Map();
  for (const row of elsewhere) {
    const key = normaliseCnic(row.cand_cnic);
    if (!otherBatches.has(key)) otherBatches.set(key, []);
    otherBatches.get(key).push(row.tb_id);
  }

  const plan = [];

  for (const entry of entries) {
    const candidate = byCnic.get(entry.cnic);

    if (!candidate) {
      const others = otherBatches.get(entry.cnic);
      plan.push({
        ...entry,
        status: "not_found",
        message: others?.length
          ? `No candidate in this batch. This CNIC applied in batch ${[...new Set(others)].join(", ")}.`
          : "No candidate with this CNIC has applied",
      });
      continue;
    }

    const blocker = await findBlocker(candidate, undefined, {
      requireRecommendation: false,
    });

    // Enrolled regardless, but never silently. Somebody the panel did not
    // mark as recommended is still going in - that is what the list says to
    // do - and the operator should be able to see which rows those are
    // before confirming, in case a CNIC was typed wrong.
    const unrecommended = candidate.recommended !== "Yes";

    plan.push({
      ...entry,
      cand_id: candidate.cand_id,
      name: candidate.cand_name,
      email: candidate.cand_email,
      center_id: candidate.center_id,
      course_id: candidate.course_id,
      status: blocker ? blocker.status : "ready",
      message: blocker
        ? blocker.message
        : unrecommended
        ? "Will be enrolled (not marked recommended at interview)"
        : "Will be enrolled",
      unrecommended: blocker ? undefined : unrecommended,
    });
  }

  return plan;
};

/** Counts per status, so the screen can lead with the number that matters. */
const summarise = (plan, skipped) => {
  const counts = {};
  for (const row of plan) counts[row.status] = (counts[row.status] || 0) + 1;
  return {
    readable: plan.length,
    ready: counts.ready || 0,
    already_enrolled: counts.already_enrolled || 0,
    // Kept in the shape for the single-enrolment path, which still enforces
    // it. A bulk upload never produces this status.
    not_recommended: counts.not_recommended || 0,
    // Counted separately: these ARE being enrolled, and the operator is
    // told how many so the number is a decision rather than a surprise.
    unrecommended_included: plan.filter((row) => row.unrecommended).length,
    not_found: counts.not_found || 0,
    no_email: counts.no_email || 0,
    email_taken: counts.email_taken || 0,
    phone_taken: counts.phone_taken || 0,
    no_schedule: counts.no_schedule || 0,
    unreadable: skipped.length,
  };
};

/** Read the uploaded file, or explain why it could not be read. */
const readUpload = (req) => {
  if (!req.file?.buffer) {
    const error = new Error("Please choose a .xlsx or .csv file to upload");
    error.statusCode = 400;
    throw error;
  }
  try {
    return parseCnicList(req.file.buffer, req.file.originalname);
  } catch (parseError) {
    parseError.statusCode = 400;
    throw parseError;
  }
};

const requireBatch = (req) => {
  const tb_id = req.body?.tb_id || req.query?.tb_id;
  if (!tb_id) {
    const error = new Error(
      "Select a training batch before uploading - a CNIC can have applied in more than one"
    );
    error.statusCode = 400;
    throw error;
  }
  return tb_id;
};

// Exported for controllers/candidateEnrollmentBulk.test.js, which drives the
// classification without a database. Not part of the HTTP surface.
exports._internals = { findBlocker, planBulkEnrollment, summarise };

/** The template, so nobody has to guess the column name. */
exports.downloadCnicTemplate = async (_req, res) => {
  try {
    const csv = buildCnicTemplateCsv();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="enrollment-cnic-template.csv"'
    );
    return res.send(csv);
  } catch (error) {
    console.error("CNIC template error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Could not build the template" });
  }
};

/**
 * Dry run. Nothing is written.
 *
 * Enrolling creates real LMS accounts and sends real email, so the operator
 * sees exactly who will be affected - and, more importantly, who will not and
 * why - before any of it happens.
 */
exports.previewBulkEnrollment = async (req, res) => {
  try {
    const tb_id = requireBatch(req);
    const { cnics, skipped, total } = readUpload(req);
    const plan = await planBulkEnrollment(cnics, tb_id);

    return res.json({
      success: true,
      tb_id,
      rowsInFile: total,
      summary: summarise(plan, skipped),
      plan,
      skipped,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error("Bulk enrollment preview error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error reading the CNIC list" });
  }
};

/**
 * Enrol everyone the plan says is ready.
 *
 * The file is re-read and re-planned rather than trusting a plan the browser
 * sends back: between the preview and the confirmation somebody may have
 * enrolled one of these candidates by hand, or withdrawn a recommendation, and
 * the writes must match the database as it is now.
 *
 * One transaction PER candidate. A single bad record - a gender nobody can
 * parse, a roll number clash - must not roll back the two hundred that were
 * fine, which is what a single wrapping transaction would do.
 */
exports.bulkEnrollByCnic = async (req, res) => {
  try {
    const tb_id = requireBatch(req);
    const { cnics, skipped, total } = readUpload(req);
    const plan = await planBulkEnrollment(cnics, tb_id);

    const ready = plan.filter((row) => row.status === "ready");
    if (ready.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Nobody in this file can be enrolled. See the breakdown for why.",
        summary: summarise(plan, skipped),
        plan,
        skipped,
      });
    }

    const results = [];
    let enrolled = 0;
    let failed = 0;
    let emailsQueued = 0;
    const emailNotSent = [];

    for (const row of ready) {
      const transaction = await sequelize.transaction();
      try {
        const candidate = await Candidate.findByPk(row.cand_id, { transaction });
        if (!candidate) throw new Error("Candidate disappeared mid-run");

        // Re-checked inside the transaction. The plan was built a moment ago
        // and without one, so this is what actually prevents a double enrolment
        // when two admins upload overlapping lists at the same time.
        const blocker = await findBlocker(candidate, transaction, {
          requireRecommendation: false,
        });
        if (blocker) {
          await transaction.rollback();
          results.push({ ...row, status: blocker.status, message: blocker.message });
          continue;
        }

        const { rollNumber, centerId, courseId, batchId, email } =
          await createStudentFromCandidate(candidate, {}, transaction);

        await transaction.commit();
        enrolled += 1;

        // After the commit, and not awaited: the welcome email must never be
        // able to undo an enrolment, and awaiting hundreds of them in turn
        // would hold the request open long past any sensible timeout.
        const mail = await sendWelcomeEmail(
          candidate,
          rollNumber,
          centerId,
          courseId,
          email,
          batchId,
          { queue: true }
        );
        if (mail?.status === "queued") emailsQueued += 1;
        else emailNotSent.push(email);

        results.push({
          ...row,
          status: "enrolled",
          message: `Enrolled as ${rollNumber}`,
          std_rollno: rollNumber,
        });
      } catch (error) {
        await transaction.rollback();
        failed += 1;

        const detail =
          error.name === "SequelizeValidationError"
            ? (error.errors || []).map((item) => `${item.path}: ${item.message}`).join("; ")
            : error.message;

        console.error(
          `[bulk enroll] candidate ${row.cand_id} (${row.formatted}) failed:`,
          detail
        );
        results.push({ ...row, status: "failed", message: detail });
      }
    }

    // Rows the plan had already ruled out, carried through so the report
    // accounts for every line of the file rather than only the ones acted on.
    const untouched = plan.filter((row) => row.status !== "ready");

    console.log(
      `[bulk enroll] batch ${tb_id}: ${enrolled} enrolled, ${failed} failed, ` +
        `${untouched.length} skipped, by user ${req.user.id} (${req.user.username})`
    );

    return res.json({
      success: true,
      message: `Enrolled ${enrolled} candidate(s).`,
      tb_id,
      rowsInFile: total,
      enrolled,
      failed,
      results: [...results, ...untouched],
      skipped,
      // Welcome emails go out in the background, paced, and on a metered
      // provider come out of the day's allowance. Said plainly so nobody
      // reads a quiet inbox as a failed enrolment.
      emailsQueued,
      emailNotSent,
      note:
        `${emailsQueued} welcome email(s) queued; they are sent a few at a time and ` +
        "may take several minutes to all arrive." +
        (emailNotSent.length
          ? ` ${emailNotSent.length} could not be prepared - see the server log.`
          : ""),
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error("Bulk enrollment error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error during bulk enrolment" });
  }
};
