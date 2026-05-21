import { ReactNode } from 'react';
import type { LoginCredentials, Admin as AdminType } from './admin';

// Re-export Admin type from admin.ts to ensure consistency
export type Admin = AdminType;

export interface AuthState {
  admin: Admin | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
}

export interface AuthContextType extends Omit<AuthState, 'loading'> {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  initialLoading: boolean;
}

export interface AuthProviderProps {
  children: ReactNode;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  admin: Admin;
  message?: string;
}