import { useState, useEffect, useCallback } from "react";
import type { AuthState } from "../types/auth";
import type { LoginCredentials } from "../types/admin";
import { loginAdmin, logoutAdminSession } from "../services/api";
import { storage } from "../utils/storage";

/**
 * Custom hook for managing authentication state
 */
export const useAuthState = () => {
  const [state, setState] = useState<AuthState>({
    admin: storage.getAdmin(),
    token: storage.getToken(),
    isAuthenticated: false,
    loading: true,
  });
  
  // Add isLoading state for login/logout operations
  const [isLoading, setIsLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Initialize auth state from storage
  useEffect(() => {
    const token = storage.getToken();
    const admin = storage.getAdmin();

    setState({
      admin,
      token,
      isAuthenticated: !!token && !!admin,
      loading: false,
    });
    
    setInitialLoading(false);
  }, []);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      try {
        setIsLoading(true);
        storage.clearSessionState();
        const response = await loginAdmin(credentials);

        storage.setToken(response.token);
        storage.setAdmin(response.admin);

        setState({
          admin: response.admin,
          token: response.token,
          isAuthenticated: true,
          loading: false,
        });
      } catch (error) {
        storage.clearAuth();
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const logout = useCallback(() => {
    setIsLoading(true);
    void logoutAdminSession();
    storage.clearAuth();

    setState({
      admin: null,
      token: null,
      isAuthenticated: false,
      loading: false,
    });

    window.location.replace("/login");
    setIsLoading(false);
  }, []);

  return {
    ...state,
    login,
    logout,
    isLoading,
    initialLoading,
  };
};
