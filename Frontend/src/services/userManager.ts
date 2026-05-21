export const addUserId = (userId: string): void => {
  const storedUserIds = localStorage.getItem('activeUsers');
  const userIds = storedUserIds ? JSON.parse(storedUserIds) : [];
  
  if (!userIds.includes(userId)) {
    userIds.push(userId);
    localStorage.setItem('activeUsers', JSON.stringify(userIds));
  }
};

export const removeUserId = (userId: string): void => {
  const storedUserIds = localStorage.getItem('activeUsers');
  if (!storedUserIds) return;
  
  const userIds = JSON.parse(storedUserIds);
  const index = userIds.indexOf(userId);
  if (index > -1) {
    userIds.splice(index, 1);
    localStorage.setItem('activeUsers', JSON.stringify(userIds));
  }
};

export const getUserIds = (): string[] => {
  const storedUserIds = localStorage.getItem('activeUsers');
  return storedUserIds ? JSON.parse(storedUserIds) : [];
};

export const getCurrentUserId = (): string | null => {
  return localStorage.getItem('currentAdmin');
};

export const getPreviousUserId = (): string | null => {
  return localStorage.getItem('previousUserId');
};
