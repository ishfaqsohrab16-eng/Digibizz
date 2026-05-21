import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { AuthState } from "../types/auth";
import type { LoginCredentials } from "../types/admin";
import { loginAdmin } from "../services/api";
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

  const navigate = useNavigate();

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
    [navigate]
  );

  const logout = useCallback(() => {
    setIsLoading(true);
    storage.clearAuth();

    setState({
      admin: null,
      token: null,
      isAuthenticated: false,
      loading: false,
    });

    navigate("/login");
    setIsLoading(false);
  }, [navigate]);

  return {
    ...state,
    login,
    logout,
    isLoading,
    initialLoading,
  };
};
