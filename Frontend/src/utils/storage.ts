import type { Admin } from '../types/auth';

const TOKEN_KEY = 'auth_token';
const ADMIN_KEY = 'admin_user';

/**
 * Storage utility for managing authentication data
 */
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
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);
  }
};