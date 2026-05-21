import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUrlWithCurrentParams, isSubUserSession } from '../utils/urlUtils';

/**
 * Custom hook for navigation that preserves sub-user session parameters
 */
export const useSubUserNavigation = () => {
  const navigate = useNavigate();
  
  /**
   * Navigate to a path while preserving query parameters in sub-user sessions
   */
  const navigateTo = useCallback((path: string) => {
    if (isSubUserSession()) {
      // In sub-user session, preserve query parameters by using direct browser navigation
      const fullUrl = createUrlWithCurrentParams(path);
      window.location.href = fullUrl;
    } else {
      // Normal navigation through React Router
      navigate(path);
    }
  }, [navigate]);
  
  /**
   * Create a URL with current query parameters
   */
  const createUrl = useCallback((path: string) => {
    return createUrlWithCurrentParams(path);
  }, []);
  
  return {
    navigateTo,
    createUrl,
    isSubUserSession: isSubUserSession()
  };
};
