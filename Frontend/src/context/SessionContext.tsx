import React, { createContext, useContext, useState, useEffect } from 'react';

interface SessionContextType {
  isSubUserSession: boolean;
  currentSessionUserId: string | null;
  originalUserId: string | null;
  getSessionUserData: <T>(key: string) => T | null;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSubUserSession, setIsSubUserSession] = useState<boolean>(false);
  const [currentSessionUserId, setCurrentSessionUserId] = useState<string | null>(null);
  const [originalUserId, setOriginalUserId] = useState<string | null>(null);

  useEffect(() => {
    // Detect if we're in a sub-user session from URL
    const urlParams = new URLSearchParams(window.location.search);
    const subUserId = urlParams.get('subuser');
    
    if (subUserId) {
      setIsSubUserSession(true);
      setCurrentSessionUserId(subUserId);
      // Store the main admin ID as the original
      setOriginalUserId(localStorage.getItem('currentAdmin'));
    } else {
      setIsSubUserSession(false);
      setCurrentSessionUserId(localStorage.getItem('currentAdmin'));
      setOriginalUserId(null);
    }
  }, []);

  // Helper function to get user data based on session context
  const getSessionUserData = <T,>(key: string): T | null => {
    try {
      const userId = currentSessionUserId;
      if (!userId) return null;
      
      const data = localStorage.getItem(`${key}${userId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Error retrieving ${key} data:`, error);
      return null;
    }
  };

  return (
    <SessionContext.Provider
      value={{
        isSubUserSession,
        currentSessionUserId,
        originalUserId,
        getSessionUserData
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
