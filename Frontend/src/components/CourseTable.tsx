import React, { useState, useEffect } from "react";
import { getAllCourse } from "../services/api";

import { DynamicTable } from "./DataTable/DynamicTable";
import SettingsHeader from "./Settings/SettingsHeader";
interface CourseFormData {
  id: number; // Add this field
  course_name: string;
  course_full_name: string;
  course_status: number;
}
const CourseTable = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseFormData, setCourseFormData] = useState<CourseFormData[]>([]);
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const data = await getAllCourse();
        setCourseFormData(data);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Failed to fetch courses"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, []);
  const columns = [
    { key: "index", header: "#", headerClassName: "w-[50px]" },
    { key: "course_name", header: "Course Name", sortable: true },
    {
      key: "course_full_name",
      header: "Course Full Name",
      className: "font-medium",
      sortable: true,
    },
    { key: "course_status", header: "Status", sortable: true },
  ];

  if (loading) return <div className="text-center p-4">Loading...</div>;
  if (error) return <div className="text-red-500 p-4">{error}</div>;

  return (
    <div className="w-full">
      <SettingsHeader
        SettingsHeader="Enrolled Course"
        SettingDescription="Enrolled Courses Data"
      />
      <div className="mt-8">
        <DynamicTable
          columns={columns}
          data={courseFormData}
          onEdit={(item) => console.log("Edit:", item)}
          onView={(item) => console.log("View:", item)}
        />
      </div>
    </div>
  );
};

export default CourseTable;
