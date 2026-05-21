import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserData } from '../types/admin';

// Define available theme options
export type ThemeOption = 'mint' | 'aurora' | 'ocean' | 'slate' | 'peach' | 'system';

interface ThemeContextType {
  theme: ThemeOption;
  setTheme: (theme: ThemeOption) => void;
  resolvedTheme: ThemeOption; // The actual theme after resolving 'system'
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'mint',
  setTheme: () => {},
  resolvedTheme: 'mint'
});

interface ThemeProviderProps {
  children: ReactNode;
}

const getCurrentSessionUserId = (): string | null => {
  // First check URL for sub-user parameter
  const urlParams = new URLSearchParams(window.location.search);
  const subUserId = urlParams.get("subuser");

  // If in a sub-user session, return that ID
  if (subUserId) {
    return subUserId;
  }

  // Otherwise return the main admin ID
  return localStorage.getItem("currentAdmin");
};

const getUserType = (): string => {
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

export const ThemeProvider = ({ children }: ThemeProviderProps) => {  
  // Get theme from localStorage or default to 'mint', using user-specific key
  const [theme, setTheme] = useState<ThemeOption>(() => {
    const userId = getCurrentSessionUserId();
    const themeKey = userId ? `theme_${userId}` : 'theme_default';
    const savedTheme = localStorage.getItem(themeKey);
    return (savedTheme as ThemeOption) || 'mint';
  });

  // Keep track of the resolved theme (after system preference)
  const [resolvedTheme, setResolvedTheme] = useState<ThemeOption>('mint');

  // Check for user ID changes
  useEffect(() => {
    const checkUserId = () => {
      const newUserId = getCurrentSessionUserId();
     
        // Load theme for the new user
        const themeKey = newUserId ? `theme_${newUserId}` : 'theme_default';
        const savedTheme = localStorage.getItem(themeKey);
        setTheme((savedTheme as ThemeOption) || 'mint');
      
    };

    // Check immediately and also set up an interval to check periodically
    checkUserId();
    const interval = setInterval(checkUserId, 2000);
    
    return () => clearInterval(interval);
  }, []);

  // Effect to save theme to localStorage when it changes, using user-specific key
  useEffect(() => {
    const userId = getCurrentSessionUserId();
    const themeKey = userId ? `theme_${userId}` : 'theme_default';
    localStorage.setItem(themeKey, theme);
  }, [theme]);

  // Effect to apply theme to the document
  useEffect(() => {
    // Remove all existing theme classes
    document.documentElement.classList.remove(
      'theme-mint', 
      'theme-aurora', 
      'theme-ocean', 
      'theme-slate', 
      'theme-peach'
    );
    
    // If theme is 'system', detect system preference
    if (theme === 'system') {
      const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const systemTheme: ThemeOption = isDarkMode ? 'aurora' : 'mint';
      
      document.documentElement.classList.add(`theme-${systemTheme}`);
      setResolvedTheme(systemTheme);
      
      // Listen for changes in system preference
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        const newSystemTheme: ThemeOption = e.matches ? 'aurora' : 'mint';
        document.documentElement.classList.add(`theme-${newSystemTheme}`);
        setResolvedTheme(newSystemTheme);
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // Apply the selected theme directly
      document.documentElement.classList.add(`theme-${theme}`);
      setResolvedTheme(theme);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
