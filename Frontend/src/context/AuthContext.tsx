import React, { createContext, useContext } from 'react';
import type { AuthContextType, AuthProviderProps } from '../types/auth';
import { useAuthState } from '../hooks/useAuthState';
import Loader from '../components/Loader';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Provider component for authentication context
 */
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const auth = useAuthState();
  
  if (auth.initialLoading) {
    return <Loader message="Initializing application..." />;
  }
  
  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Custom hook to use the auth context
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};