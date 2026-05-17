process.env.TZ = "Asia/Karachi";
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const session = require("express-session");
const path = require("path");
require("dotenv").config();
const { sequelize, testConnection } = require("./config/db");

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

require("./models/courseModuleAssociation");
const app = express();

// Security Middleware
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Allow requests without an Origin header, such as curl or server-to-server traffic.
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
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
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Body Parsing Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
// Catch-all handler to return the React frontend's index.html file
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({
    status: "error",
    message: err.message || "Something went wrong!",
  });
});

// Database Connection and Sync
const initializeDatabase = async () => {
  try {
    await testConnection();
    await sequelize.sync({ alter: false });
    console.log("Database connected and models synced successfully");
  } catch (error) {
    console.error("Database initialization error:", error);
    process.exit(1);
  }
};

initializeDatabase();
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
module.exports = app;
