/**
 * Utility functions for managing user sessions and sub-user sessions
 */

import { UserData } from "../types/admin";

/**
 * Get the current active user ID considering the session context
 */
export const getCurrentSessionUserId = (): string | null => {
  // First check URL for sub-user parameter
  const urlParams = new URLSearchParams(window.location.search);
  const subUserId = urlParams.get('subuser');
  
  // If in a sub-user session, return that ID
  if (subUserId) {
    return subUserId;
  }
  
  // Otherwise return the main admin ID
  return localStorage.getItem('currentAdmin');
};

/**
 * Check if we're in a sub-user session
 */
export const isSubUserSession = (): boolean => {
  return !!new URLSearchParams(window.location.search).get('subuser');
};

/**
 * Get user type based on current session context
 */
export const getUserType = (): string => {
  try {
    const userId = getCurrentSessionUserId();

    if (!userId) {
      return "UserAdmin";
    }

    const admin = localStorage.getItem(`admin${userId}`);
    if (!admin) {
      return "UserAdmin";
    }

    const parsedAdmin: UserData = JSON.parse(admin);
    return parsedAdmin?.type || "UserAdmin";
  } catch (error) {
    console.error("Error parsing admin data:", error);
    return "UserAdmin";
  }
};

/**
 * Get user data based on current session context
 */
export const getSessionUserData = <T,>(key: string): T | null => {
  try {
    const userId = getCurrentSessionUserId();
    if (!userId) return null;
    
    const data = localStorage.getItem(`${key}${userId}`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`Error retrieving ${key} data:`, error);
    return null;
  }
};

/**
 * Create a URL for logging in as a sub-user
 */
export const createSubUserSessionUrl = (userId: number | string): string => {
  const timestamp = new Date().getTime();
  return `/dashboard?subuser=${userId}&t=${timestamp}`;
};
