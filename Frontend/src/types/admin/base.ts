/**
 * Available admin role types
 */
export type AdminType = "SuperAdmin" | "ContentAdmin" | "ReadOnlyAdmin";
export type UserType =
  | "student"
  | "trainer"
  | "SuperAdmin"
  | "ContentAdmin"
  | "ReadOnlyAdmin"
  | "MasterTainer";

/**
 * Base admin properties that are common across different contexts
 */
export interface BaseAdmin {
  admin_id: number;
  admin_name: string;
  user_username: string;
  admin_type: AdminType;
  user_type: UserType;
}

/**
 * Admin preferences that can be customized
 */
export interface AdminPreferences {
  dark_mode?: boolean;
  profile_photo?: string;
}
