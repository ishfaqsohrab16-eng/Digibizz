import { getUserIds } from "../services/userManager";

interface UserData {
  id: string;
  type: string;
  center_id: string;
  course_id: string;
}

// Enhanced function to get user type with session awareness
const getUserType = (forceUserId?: string): UserData | string => {
  try {
    // If we're explicitly requesting a specific user ID
    if (forceUserId) {
      const adminData = localStorage.getItem(`admin${forceUserId}`);
      if (adminData) {
        const parsedAdmin: UserData = JSON.parse(adminData);
        if (parsedAdmin?.type) {
          return parsedAdmin;
        }
      }
    }
    
    // Check URL for sub-user session flag
    const urlParams = new URLSearchParams(window.location.search);
    const subUserId = urlParams.get('subuser');
    
    // If we're in a sub-user session, use that ID
    if (subUserId) {
      const adminData = localStorage.getItem(`admin${subUserId}`);
      if (adminData) {
        const parsedAdmin: UserData = JSON.parse(adminData);
        if (parsedAdmin?.type) {
          return parsedAdmin;
        }
      }
    }
    
    // Otherwise use currentAdmin from localStorage
    const currentAdmin = localStorage.getItem("currentAdmin");
    const adminData = localStorage.getItem(`admin${currentAdmin}`);

    if (adminData) {
      const parsedAdmin: UserData = JSON.parse(adminData);
      if (parsedAdmin?.type) {
        return parsedAdmin;
      }
    }

    console.log("No admin data found");
    return "UserAdmin";
  } catch (error) {
    console.error("Error parsing admin data:", error);
    return "UserAdmin";
  }
};

// Get current user ID considering session context
export const getCurrentSessionUserId = (): string | null => {
  // First check URL for sub-user parameter
  const urlParams = new URLSearchParams(window.location.search);
  const subUserId = urlParams.get('subuser');
  
  // If in a sub-user session, return that ID
  if (subUserId) {
    return subUserId;
  }
  
  // Otherwise return the main admin ID
  return localStorage.getItem('currentAdmin');
};

// Enhanced user management functions
const setUserId = (id: string) => {
  localStorage.setItem("currentUserId", id);
};

const setCenterId = (centerId: string) => {
  localStorage.setItem("currentCenterId", centerId);
};

const setCourseId = (courseId: string) => {
  localStorage.setItem("currentCourseId", courseId);
};

// New functions for managing multiple user sessions
export const addUserToSession = (userId: string) => {
  const activeUsers = getUserIds();
  if (!activeUsers.includes(userId)) {
    activeUsers.push(userId);
    localStorage.setItem('activeUsers', JSON.stringify(activeUsers));
  }
};

export const switchToUser = (userId: string) => {
  localStorage.setItem('previousUserId', localStorage.getItem('currentAdmin') || '');
  localStorage.setItem('currentAdmin', userId);
  return userId;
};

export const switchBackToPreviousUser = () => {
  const previousUserId = localStorage.getItem('previousUserId');
  if (previousUserId) {
    localStorage.setItem('currentAdmin', previousUserId);
    return previousUserId;
  }
  return null;
};

export { getUserType, setUserId, setCenterId, setCourseId };
