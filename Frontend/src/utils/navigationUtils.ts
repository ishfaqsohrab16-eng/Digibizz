/**
 * Navigation utilities for preserving query parameters during navigation
 */

/**
 * Creates a URL with the current query parameters preserved
 * @param basePath The base path to navigate to
 * @param additionalParams Any additional query parameters to add
 * @returns Full URL with query parameters
 */
export const createUrlWithCurrentParams = (basePath: string, additionalParams?: Record<string, string>): string => {
  // Get current URL parameters
  const currentParams = new URLSearchParams(window.location.search);
  
  // Add any additional parameters
  if (additionalParams) {
    Object.entries(additionalParams).forEach(([key, value]) => {
      currentParams.set(key, value);
    });
  }
  
  const queryString = currentParams.toString();
  return `${basePath}${queryString ? `?${queryString}` : ''}`;
};

/**
 * Navigate to a path while preserving query parameters
 * Works with both React Router and direct browser navigation
 * 
 * @param path The path to navigate to
 */
export const navigateWithParams = (path: string): void => {
  const urlWithParams = createUrlWithCurrentParams(path);
  
  // Using history API for smooth navigation while preserving params
  window.history.pushState({}, '', urlWithParams);
  
  // Dispatch event to notify the app about URL change
  window.dispatchEvent(new PopStateEvent('popstate'));
};

/**
 * Check if the current session is a sub-user session
 */
export const isSubUserSession = (): boolean => {
  return !!new URLSearchParams(window.location.search).get('subuser');
};

/**
 * Create a sub-user session URL
 */
export const createSubUserSessionUrl = (userId: string | number, path = '/dashboard'): string => {
  const timestamp = new Date().getTime();
  return `${path}?subuser=${userId}&t=${timestamp}`;
};
