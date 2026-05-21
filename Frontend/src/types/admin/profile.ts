import type { BaseAdmin, AdminType, AdminPreferences } from "./base";

/**
 * Complete admin profile with all properties
 */
export interface Admin extends BaseAdmin, AdminPreferences {}

/**
 * Data required for admin registration
 */
export interface AdminRegistrationData {
  admin_name: string;
  admin_username: string;
  admin_password: string;
  admin_type?: AdminType;
  profile_photo?: string;
}

/**
 * Properties that can be updated in admin profile
 */
export type AdminProfileUpdate = Partial<
  Pick<Admin, "admin_name" | "profile_photo" | "dark_mode">
>;
