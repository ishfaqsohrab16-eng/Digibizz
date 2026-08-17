const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

/**
 * Canonical roles, lower-cased.
 *
 * Roles are compared case-insensitively on purpose. The database stores mixed
 * casing ("student", "MasterTrainer", "Center Manager") and a guard written as
 * `userType !== "Student"` silently failed open, exposing staff-only screens to
 * students. Normalising removes that whole class of bug.
 */
const ROLES = {
  SUPER_ADMIN: "superadmin",
  CONTENT_ADMIN: "contentadmin",
  READONLY_ADMIN: "readonlyadmin",
  MASTER_TRAINER: "mastertrainer",
  TRAINER: "trainer",
  STUDENT: "student",
  COORDINATOR: "coordinator",
  MANAGER: "manager",
  CENTER_MANAGER: "center manager",
};

const normaliseRole = (userType) => String(userType || "").trim().toLowerCase();

/** Roles allowed to see any student's data across centers. */
const ADMIN_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.CONTENT_ADMIN,
  ROLES.READONLY_ADMIN,
  ROLES.MASTER_TRAINER,
  ROLES.MANAGER,
  ROLES.COORDINATOR,
];

/** Roles allowed to record attendance. */
const ATTENDANCE_MARKER_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.CONTENT_ADMIN,
  ROLES.MASTER_TRAINER,
  ROLES.TRAINER,
  ROLES.CENTER_MANAGER,
  ROLES.MANAGER,
  ROLES.COORDINATOR,
];

/** Roles allowed to view attendance for other people. */
const ATTENDANCE_VIEWER_ROLES = [...ATTENDANCE_MARKER_ROLES, ROLES.READONLY_ADMIN];

/**
 * Route guard: allow only the listed roles. Must run after
 * isAdminAuthenticated, which populates req.user.
 */
const requireRoles = (...allowed) => {
  const permitted = allowed.flat().map(normaliseRole);
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    // Normalise here as well as in isAdminAuthenticated, so the guard is
    // correct no matter how req.user was populated.
    const role = normaliseRole(req.user.role || req.user.type);
    if (!permitted.includes(role)) {
      return res.status(403).json({
        message: "You do not have permission to perform this action",
      });
    }
    next();
  };
};

const isAdminAuthenticated = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Extract token (expecting "Bearer <token>")
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Invalid token format" });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if admin exists
    const user = await User.findByPk(decoded.id);

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Attach admin to request object (kept for existing controllers)
    req.admin = {
      id: user.user_id,
      username: user.user_username,
    };

    // Authoritative identity for authorisation. Controllers must read the role
    // from here and never from req.query/req.body, which the client controls.
    req.user = {
      id: user.user_id,
      username: user.user_username,
      email: user.user_email,
      type: user.user_type,
      role: normaliseRole(user.user_type),
    };

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token" });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }

    console.error("Authentication error:", error);
    res.status(500).json({ message: "Server authentication error" });
  }
};

module.exports = {
  isAdminAuthenticated,
  requireRoles,
  normaliseRole,
  ROLES,
  ADMIN_ROLES,
  ATTENDANCE_MARKER_ROLES,
  ATTENDANCE_VIEWER_ROLES,
};
