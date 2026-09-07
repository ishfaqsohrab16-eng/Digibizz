process.env.TZ = "Asia/Karachi";
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const session = require("express-session");
const path = require("path");
require("dotenv").config();
const { sequelize, testConnection } = require("./config/db");
const { ensureSchema } = require("./utils/ensureSchema");

// Import routes
const adminRoutes = require("./routes/adminRoutes");
const trainingBatchRoutes = require("./routes/trainingBatchRoutes");
const courseRoutes = require("./routes/courseRoutes");
const centerRoutes = require("./routes/centerRoutes");
const centerUsersRoutes = require("./routes/centerUsersRoutes");
const centersDatesRoutes = require("./routes/centersDatesRoutes");
const masterTrainersRoutes = require("./routes/masterTrainersRoutes");
const trainersRoutes = require("./routes/trainersRoutes");
const StudentRoutes = require("./routes/studentRoutes");
const ActivityLog = require("./routes/activityLogRoutes");
const AssignmentRoutes = require("./routes/assignmentRoutes");
const AssignmentSubmissionRoutes = require("./routes/assignmentSubmissionRoutes");
const uploadRoutes = require("./routes/uploadImageRoutes");
const UserRoutes = require("./routes/userRoutes");
const TrainersCenterAllocation = require("./routes/trainerCenterAllocationRoutes");
const CandidateRouets = require("./routes/candidateRoutes");
const classScheduleRoutes = require("./routes/classScheduleRoutes");
const TrainerAttendance = require("./routes/trainerAttendanceRouets");
const EarningsRoutes = require("./routes/earningsRoutes");
const AttendanceRoutes = require("./routes/attendanceRoutes");
const studentLeaveRoutes = require("./routes/studentLeaveRoutes");
const trainerLeaveRoutes = require("./routes/trainerLeaveRoutes");
const examAssessmentRoutes = require("./routes/examAssessmentRoutes");
const holidaysRoutes = require("./routes/holidaysRoutes");
const studentsFeedbackRouter = require("./routes/feedbackRoutes");
const StudentsFreelancing = require("./routes/freelancingRoutes");
const StudentDocumentRoutes = require("./routes/studentsDocsRoutes");
const activityLogRoutes = require("./routes/activityLogRoutes");
const quizRoutes = require("./routes/quizRouter");
const dailyLectureReportRoutes = require("./routes/dailyLectureReport");
const dashboardRoutes = require("./routes/dashboardRoutes");
const classAnnouncementsRoutes = require("./routes/classAnnouncementsRoutes");
const ticketRoutes = require("./routes/ticketRoutes");
const lectureRecordingRoutes = require("./routes/lectureRecordingRoutes");
const learningResourceRoutes = require("./routes/learningResourceRoutes");
const certificateRoutes = require("./routes/certificate");
const courseModuleRoutes = require("./routes/courseModuleRoutes");
const trainerTopicReportRoutes = require("./routes/trainerTopicReportRoutes");
const admissionControlRoutes = require("./routes/admissionControlRoutes");
const emailCampaignRoutes = require("./routes/emailCampaignRoutes");
const aiAssistantRoutes = require("./routes/aiAssistantRoutes");

require("./models/courseModuleAssociation");
// Registered explicitly so sync() creates their tables on first boot.
// Nothing requires them before sync otherwise - only the dispatcher and the
// contact sweeper do, and both load later - which would leave them writing
// to tables that do not exist yet.
require("./models/emailSendQuotaModel");
require("./models/brevoContactModel");
require("./models/emailOutboxModel");
require("./models/classScheduleModel");
const app = express();

// Security Middleware
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

/**
 * The last origin refused, so a bot hammering the API logs one line rather
 * than one per request. Deliberately not a Set - this is a log-noise guard,
 * not an audit trail, and an unbounded Set fed by request headers is a slow
 * memory leak.
 */
let lastRefusedOrigin = null;

const corsOptions = {
  origin(origin, callback) {
    // Allow requests without an Origin header, such as curl or server-to-server traffic.
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Refuse by omitting the CORS headers, not by throwing.
    //
    // Throwing sent the rejection to the global error handler, which turned
    // every one into a 500 with a stack trace - filling the log with
    // "Origin null is not allowed by CORS" from sandboxed iframes, file://
    // pages, link previewers and redirects, none of which are a server
    // fault. Answering without the headers is what CORS is actually for:
    // the request is served, and the BROWSER refuses to hand the response
    // to a page that is not allowed to read it.
    //
    // "null" in particular is never added to the allowlist. It is not an
    // origin, it is the absence of one, and honouring it with
    // credentials: true would let any sandboxed frame make signed-in
    // requests.
    if (origin !== lastRefusedOrigin) {
      lastRefusedOrigin = origin;
      console.warn(`[cors] refused an unlisted origin: ${origin}`);
    }
    return callback(null, false);
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", ...allowedOrigins],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        // `blob:` is required for client-side image previews: the registration
        // form renders the chosen passport photo via URL.createObjectURL(),
        // which produces a blob: URL. Without it the preview is blocked and
        // shows a broken-image icon.
        imgSrc: ["'self'", "data:", "blob:"],
        fontSrc: ["'self'"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Body Parsing Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Lightweight health endpoint for container/platform checks.
app.get("/healthz", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Session Configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "none", // Use "none" if frontend is on a different origin
    },
  })
);

// Serve Static Files (Uploads)
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    setHeaders: (res) => {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "GET");
      res.set(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
      );
      res.set("Cross-Origin-Resource-Policy", "cross-origin");
    },
  })
);

// Serve React Frontend Static Files
app.use(
  express.static(path.join(__dirname, "dist"), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".js")) {
        res.setHeader("Content-Type", "application/javascript");
      } else if (filePath.endsWith(".css")) {
        res.setHeader("Content-Type", "text/css");
      }
    },
  })
);

// Routes
app.use("/api/admin", adminRoutes);
app.use("/api/training_batches", trainingBatchRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/center", centerRoutes);
app.use("/api/centerUser", centerUsersRoutes);
app.use("/api/centersDates", centersDatesRoutes);
app.use("/api/mastertrainer", masterTrainersRoutes);
app.use("/api/trainer", trainersRoutes);
app.use("/api/student", StudentRoutes);
app.use("/api/activityLog", ActivityLog);
app.use("/api/assignment", AssignmentRoutes);
app.use("/api/assignment-submissions", AssignmentSubmissionRoutes);
app.use("/api", uploadRoutes);
app.use("/api/user", UserRoutes);
app.use("/api/trainersCenterAllocation", TrainersCenterAllocation);
app.use("/api/candidateRoutes", CandidateRouets);
app.use("/api/class-schedules", classScheduleRoutes);
app.use("/api/trainerAttendance", TrainerAttendance);
app.use("/api/earnings", EarningsRoutes);
app.use("/api/attendance", AttendanceRoutes);
app.use("/api/trainerLeave", trainerLeaveRoutes);
app.use("/api/studentLeave", studentLeaveRoutes);
app.use("/api/examAssessment", examAssessmentRoutes);
app.use("/api/holidays", holidaysRoutes);
app.use("/api/freelancing", StudentsFreelancing);
app.use("/api/feedback", studentsFeedbackRouter);
app.use("/api/studentDocs", StudentDocumentRoutes);
app.use("/api/activityLog", activityLogRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/dailyLectureReport", dailyLectureReportRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/announcements", classAnnouncementsRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/lecture-recordings", lectureRecordingRoutes);
app.use("/api/learning-resources", learningResourceRoutes);
app.use("/api/certificate", certificateRoutes);
app.use("/api/course-modules", courseModuleRoutes);
app.use("/api/trainer-topic-reports", trainerTopicReportRoutes);
app.use("/api/admission-control", admissionControlRoutes);
app.use("/api/email-campaigns", emailCampaignRoutes);
app.use("/api/ai-assistant", aiAssistantRoutes);
// Email confirmation has been removed from the registration form, so these
// endpoints are no longer mounted. They were the only unauthenticated way to
// make this application send mail, which on a metered provider is also a way
// to burn the day's allowance - not something to leave reachable for a
// feature nothing calls. The controller and routes file are kept, so
// restoring it is a matter of uncommenting this line.
// app.use("/api/email-verification", emailVerificationRoutes);
// Catch-all handler to return the React frontend's index.html file
/** Column names are not what a person entering a form is looking at. */
const FIELD_LABELS = {
  user_email: "email address",
  cand_email: "email address",
  std_cnic: "CNIC",
  cand_cnic: "CNIC",
  std_rollno: "roll number",
  user_username: "username",
  cand_phone: "phone number",
  std_phone: "phone number",
};

const humaniseField = (field) =>
  FIELD_LABELS[field] || String(field || "value").replace(/_/g, " ");

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

/**
 * Global error handler.
 *
 * Everything used to arrive here as a 500 with a full stack trace, whatever
 * it actually was. An upload over the size limit and a bot with a strange
 * Origin header both read as "the server is broken", the client got a
 * useless message, and the log filled with stacks for things that are not
 * faults at all.
 *
 * Each case below is a condition the CLIENT can fix, so each gets the status
 * that says so and a message that names the fix. Anything unrecognised is
 * still a 500 with its stack - those are ours.
 */
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  // Uploads. multer aborts mid-stream, so without this the request hangs
  // until the client gives up and the operator sees no reason why.
  if (err && err.name === "MulterError") {
    const limitMb = err.field && req.uploadLimitMb ? req.uploadLimitMb : null;
    const messages = {
      LIMIT_FILE_SIZE: limitMb
        ? `That file is too large. The limit is ${limitMb} MB.`
        : "That file is too large for this upload.",
      LIMIT_FILE_COUNT: "Too many files were attached.",
      LIMIT_UNEXPECTED_FILE: `Unexpected file field "${err.field}".`,
      LIMIT_PART_COUNT: "Too many parts in the upload.",
      LIMIT_FIELD_KEY: "A field name in the upload is too long.",
      LIMIT_FIELD_VALUE: "A field value in the upload is too long.",
      LIMIT_FIELD_COUNT: "Too many fields in the upload.",
    };

    console.warn(
      `[upload] ${err.code} on ${req.method} ${req.originalUrl}` +
        `${err.field ? ` (field ${err.field})` : ""}`
    );

    return res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      success: false,
      status: "error",
      code: err.code,
      message: messages[err.code] || "That upload was rejected.",
    });
  }

  // A duplicate row is somebody entering an email or CNIC that is already
  // taken. 409 and the field name, rather than a stack about SQL.
  if (err && err.name === "SequelizeUniqueConstraintError") {
    const field = err.errors?.[0]?.path;
    const value = err.errors?.[0]?.value;
    console.warn(`[conflict] ${field} "${value}" is already in use`);
    return res.status(409).json({
      success: false,
      status: "error",
      field,
      message: field
        ? `That ${humaniseField(field)} is already registered. Please use a different one.`
        : "Those details are already registered.",
    });
  }

  if (err && err.name === "SequelizeValidationError") {
    const details = (err.errors || [])
      .map((item) => `${humaniseField(item.path)}: ${item.message}`)
      .join("; ");
    return res.status(400).json({
      success: false,
      status: "error",
      message: details || "Some of those details are not valid.",
    });
  }

  // express.json() rejecting a malformed body is a client error, not ours.
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      status: "error",
      message: "The request body was not valid JSON.",
    });
  }
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      status: "error",
      message: "That request is too large.",
    });
  }

  // Ours. Keep the stack.
  console.error(err.stack || err);
  return res.status(err.status || err.statusCode || 500).json({
    success: false,
    status: "error",
    message: err.message || "Something went wrong!",
  });
});

// Database Connection and Sync
const initializeDatabase = async () => {
  try {
    await testConnection();
    // Add any missing additive columns before models are used. sync({alter:false})
    // never adds columns, so a model attribute without its column breaks every
    // query against that table - not just the new feature.
    await ensureSchema();
    await sequelize.sync({ alter: false });

    // Record every database change to activity_log. Installed after sync so
    // the hooks never fire during schema creation, which has no actor anyway.
    require("./utils/auditHooks").install();

    console.log("Database connected and models synced successfully");
  } catch (error) {
    console.error("Database initialization error:", error);
    process.exit(1);
  }
};

initializeDatabase();

// Surface SMTP problems at boot instead of on the first failed registration.
const { verifyTransport } = require("./servec/emailConfig");
verifyTransport();

// Resume any running email campaign. All progress lives in the database, so a
// restart mid-campaign picks up exactly where it stopped without re-sending.
const emailCampaignDispatcher = require("./utils/emailCampaignDispatcher");
emailCampaignDispatcher.start();

// Remove the Brevo contact for every address mailed, a day after mailing it,
// so the provider account does not accumulate a copy of everyone who ever
// applied. No-op unless Brevo is the provider.
const brevoContactCleanup = require("./utils/brevoContactCleanup");
brevoContactCleanup.start();

// Retry anything that could not be handed to a provider. This is what makes
// a spent Brevo allowance or a mail server reboot a delay rather than a
// message nobody receives and nobody hears about. `deliverNow` is injected
// rather than required inside the outbox, so the two modules do not form a
// require cycle.
const emailOutbox = require("./utils/emailOutbox");
const { deliverNow } = require("./servec/emailConfig");
emailOutbox.setDeliver(deliverNow);
emailOutbox.start();

const PORT = process.env.PORT || 5000;

// The http.Server is kept so server.js can close it on SIGTERM. Previously only
// `app` was exported, and server.js called `server.close()` on a name that was
// never defined - so every shutdown died with "server is not defined" instead of
// draining connections, and the container was killed mid-request.
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
module.exports.server = server;
