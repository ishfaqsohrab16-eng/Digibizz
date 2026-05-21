export const getAttendanceColor = (attendance: number) => {
  if (attendance >= 90) return "bg-green-100 text-green-800";
  if (attendance >= 70) return "bg-orange-100 text-orange-800";
  return "bg-red-100 text-red-800";
};
