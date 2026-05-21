// Type definitions for admin-related functionality

export interface LoginCredentials {
  user_username: string;
  user_password: string;
}

export interface Admin {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  // Add any additional properties needed
  [key: string]: any;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  admin: Admin;
  message?: string;
}

// For backward compatibility
export interface User extends Admin {
  // Any additional user-specific fields can go here
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface UserData {
  id: number;
  username: string;
  profile_photo: string;
  name: string;
  type: string;
  center_id: number;
  course_id: number;
  email: string;
  tb_id?: number;
  std_cnic?: string;
}

export type AdminType =
  | "SuperAdmin"
  | "ContentAdmin"
  | "Admin"
  | "Teacher"
  | "Student";
