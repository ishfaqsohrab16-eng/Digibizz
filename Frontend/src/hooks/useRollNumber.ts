import { useEffect } from "react";
import { generateRollNumber } from "./rollNumber";

export const useRollNumber = (
  courseId: number,
  batchId: number,
  courses: { course_id: number; course_name: string }[],
  setFormData: (value: { [key: string]: any }) => void
) => {
  useEffect(() => {
    if (courseId && batchId) {
      const course = courses.find((c) => c.course_id === courseId);
      if (course) {
        const rollNumber = generateRollNumber(course.course_id, batchId);
        setFormData((prev: { [key: string]: any }) => ({
          ...prev,
          std_rollno: rollNumber,
        }));
      }
    }
  }, [courseId, batchId, courses, setFormData]);
};
