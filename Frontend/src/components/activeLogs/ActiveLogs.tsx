import React, { useEffect, useState } from "react";
import { getStudentsProfile } from "../../services/api";
import { Column, FilterBy, StudentData, StudentStatus } from "../../types/columns";
import {
  DEFAULT_FILTER_BY_Student_Status,
  DEFAULT_STUDENT_COLUMNS,
} from "../../utils/tableUtils";

import { useBatch } from "../../context/BatchContext";
import SettingsHeader from "../Settings/SettingsHeader";
import DataTable from "../AdmissionPortal/DataTable";
interface StudentTableProps {
  user_type: string;
  center_name: string;
  course_name: string;
  user_name: string;
  user_email: string;
  user_profile_photo: string;
  user_status: string;
}
const ActiveLogs = () => {
  const [students, setStudents] = useState<StudentTableProps[]>([]);
  const [columns, setColumns] = useState<Column[]>(DEFAULT_STUDENT_COLUMNS);
  const [filterStatus, setFilterStatus] = useState<StudentStatus>("all");
  const { selectedBatchId } = useBatch();
  const [filterBy, setFilterBy] = useState<FilterBy[]>(
    DEFAULT_FILTER_BY_Student_Status
  );
  const fetchTrainingBatchesWithDates = async () => {
    try {
      const StudentsData = await getStudentsProfile(selectedBatchId);

      // Ensure it's an array before setting state
      if (Array.isArray(StudentsData.data)) {
        const updatedStudents = StudentsData.data.map((student: any) => ({
          ...student,
          user_status: student.user_status === 1 ? "Active" : "Inactive",
        }));

        setStudents(updatedStudents);
      }
    } catch (error) {
      console.error("Error fetching student data:", error);
    }
  };
  useEffect(() => {
    fetchTrainingBatchesWithDates();
  }, [selectedBatchId]);

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SettingsHeader
        SettingsHeader="Enrolled Student"
        SettingDescription="Enrolled Student Data"
      />
      <DataTable
        data={students}
        columns={columns}
        filterStatus={filterStatus}
        setColumns={setColumns}
        isActionBtn={false}
        onView={(item) => {}}
        onEdit={(item) => {}}
        onDelete={(item) => {}}
        photo="user_profile_photo"
      />
    </div>
  );
};

export default ActiveLogs;
