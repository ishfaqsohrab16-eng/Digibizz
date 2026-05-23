import type { Admin } from "../types/auth";

const TOKEN_KEY = "auth_token";
const ADMIN_KEY = "admin_user";

const EXACT_SESSION_KEYS = [
  TOKEN_KEY,
  ADMIN_KEY,
  "token",
  "authToken",
  "adminToken",
  "currentAdmin",
  "previousUserId",
  "currentUserId",
  "currentCenterId",
  "currentCourseId",
  "activeUsers",
  "studentInfo",
  "assignmentDetails",
  "selectedSubmission",
  "selectedQuiz",
  "selectedQuizResult",
  "isEditMode",
  "isViewMode",
  "courseModules",
  "mode",
  "batchPages",
  "examAssessmentCache",
];

const PREFIX_SESSION_KEYS = [
  "token",
  "admin",
  "documentStatus_",
  "lastSelectedBatch_",
  "assignmentSubmissions_",
  "currentPage-",
  "studentDashboardCache_",
  "dashboard_students_",
  "dashboard_statistics_",
  "dashboard_activity_logs_",
  "dashboard_cache_timestamp_",
];

const PRESERVED_PREFIXES = ["theme", "react-devtools"];

const shouldPreserveKey = (key: string): boolean =>
  PRESERVED_PREFIXES.some((prefix) => key.startsWith(prefix));

const shouldRemoveSessionKey = (key: string): boolean => {
  if (shouldPreserveKey(key)) {
    return false;
  }

  if (EXACT_SESSION_KEYS.includes(key)) {
    return true;
  }

  if (/^(token|admin)\d+$/.test(key)) {
    return true;
  }

  return PREFIX_SESSION_KEYS.some((prefix) => key.startsWith(prefix));
};

const clearBrowserSessionState = (): void => {
  Object.keys(localStorage).forEach((key) => {
    if (shouldRemoveSessionKey(key)) {
      localStorage.removeItem(key);
    }
  });

  sessionStorage.clear();
};

export const storage = {
  getToken: (): string | null => {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken: (token: string): void => {
    localStorage.setItem(TOKEN_KEY, token);
  },

  getAdmin: (): Admin | null => {
    const adminData = localStorage.getItem(ADMIN_KEY);
    return adminData ? JSON.parse(adminData) : null;
  },

  setAdmin: (admin: Admin): void => {
    localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
  },

  clearAuth: (): void => {
    clearBrowserSessionState();
  },

  clearSessionState: (): void => {
    clearBrowserSessionState();
  },
};
