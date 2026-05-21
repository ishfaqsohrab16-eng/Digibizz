/**
 * URL and navigation utilities for the application
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
 * Navigate to a new route while preserving query parameters
 * @param path The path to navigate to
 * @param preserveQueryParams Whether to preserve current query parameters
 */
export const navigateWithParams = (path: string, preserveQueryParams = true): void => {
  if (preserveQueryParams) {
    const urlParams = new URLSearchParams(window.location.search);
    window.location.href = `${path}?${urlParams.toString()}`;
  } else {
    window.location.href = path;
  }
};

/**
 * Create a sub-user session URL
 * @param userId The ID of the user to create a session for
 * @param path Optional base path (defaults to '/dashboard')
 * @returns URL for sub-user session
 */
export const createSubUserSessionUrl = (userId: string | number, path = '/dashboard'): string => {
  const timestamp = new Date().getTime();
  return `${path}?subuser=${userId}&t=${timestamp}`;
};

/**
 * Check if current session is a sub-user session
 */
export const isSubUserSession = (): boolean => {
  return !!new URLSearchParams(window.location.search).get('subuser');
};
