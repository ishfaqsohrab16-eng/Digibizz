/**
 * Utility functions to handle temporary storage of form data between page navigations
 */

export const storeFormData = (key: string, data: any): void => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const getFormData = (key: string): any => {
  const data = localStorage.getItem(key);
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error("Error parsing stored form data:", e);
      return null;
    }
  }
  return null;
};

export const clearFormData = (key: string): void => {
  localStorage.removeItem(key);
};

/**
 * Helper function to log FormData contents for debugging
 */
export const logFormData = (formData: FormData): void => {
  for (const pair of formData.entries()) {
  }
};
