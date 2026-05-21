import type { BaseAdmin } from "./base";

/**
 * Credentials required for admin login
 */
export interface LoginCredentials {
  user_username: string;
  user_password: string;
}

/**
 * Response structure for successful login
 */
export interface LoginResponse {
  message: string;
  token: string;
  admin: BaseAdmin;
}
