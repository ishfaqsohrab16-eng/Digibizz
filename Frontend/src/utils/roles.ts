/**
 * Role helpers.
 *
 * The database stores mixed casing ("student", "MasterTrainer", "Center
 * Manager", "SuperAdmin"). Guards written as `userType !== "Student"` silently
 * failed open and exposed staff-only screens - including Take Attendance - to
 * students. Always compare through these helpers, never with a raw string.
 */

export const ROLE = {
  SUPER_ADMIN: "superadmin",
  CONTENT_ADMIN: "contentadmin",
  READONLY_ADMIN: "readonlyadmin",
  MASTER_TRAINER: "mastertrainer",
  TRAINER: "trainer",
  STUDENT: "student",
  COORDINATOR: "coordinator",
  MANAGER: "manager",
  CENTER_MANAGER: "center manager",
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const normaliseRole = (userType?: string | null): string =>
  String(userType ?? "").trim().toLowerCase();

export const isRole = (userType: string | null | undefined, ...roles: string[]) =>
  roles.map(normaliseRole).includes(normaliseRole(userType));

export const isStudent = (userType?: string | null) => isRole(userType, ROLE.STUDENT);

export const isTrainer = (userType?: string | null) => isRole(userType, ROLE.TRAINER);

export const isMasterTrainer = (userType?: string | null) =>
  isRole(userType, ROLE.MASTER_TRAINER);

export const isCenterManager = (userType?: string | null) =>
  isRole(userType, ROLE.CENTER_MANAGER);

/** Admin-style roles that can see any student across centers. */
export const isAdmin = (userType?: string | null) =>
  isRole(
    userType,
    ROLE.SUPER_ADMIN,
    ROLE.CONTENT_ADMIN,
    ROLE.READONLY_ADMIN,
    ROLE.MANAGER,
    ROLE.COORDINATOR
  );

/**
 * Roles allowed to record attendance.
 *
 * Center Manager is deliberately excluded here even though the server permits
 * it: the sidebar has always hidden the Attendance menu from Center Managers
 * (`userType !== "Center Manager"`), and widening that is a product decision,
 * not a bug fix. The server stays permissive so no existing call starts
 * failing. Add ROLE.CENTER_MANAGER here if they should get the menu.
 */
export const canMarkAttendance = (userType?: string | null) =>
  isRole(
    userType,
    ROLE.SUPER_ADMIN,
    ROLE.CONTENT_ADMIN,
    ROLE.MASTER_TRAINER,
    ROLE.TRAINER,
    ROLE.MANAGER,
    ROLE.COORDINATOR
  );

/** Roles allowed to view other people's attendance. */
export const canViewAttendance = (userType?: string | null) =>
  canMarkAttendance(userType) || isRole(userType, ROLE.READONLY_ADMIN);

/** Roles allowed to open any individual student's attendance calendar. */
export const canViewStudentCalendar = (userType?: string | null) =>
  canViewAttendance(userType);
