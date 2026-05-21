import React, { useState, useEffect } from "react";
import { DynamicTable } from "./DataTable/DynamicTable";
import { TableActions } from "./DataTable/TableActions";
import { getMasterTrainersProfile } from "../services/api";
import { DataTable } from "./AdmissionPortal/DataTable";
import { DEFAULT_MASTER_TRAINER_COLUMNS } from "../utils/tableUtils";
import { Column } from "jspdf-autotable";
import { StudentStatus } from "../types/columns";
import SettingsHeader from "./Settings/SettingsHeader";

interface CourseData {
  courseId: number;
  course_name: string;
  full_name: string;
  status: number;
}

interface MasterTrainerApiData {
  user_id: number;
  user_name: string;
  user_username: string;
  user_email: string;
  user_type: string;
  user_status: number;
  user_profile_photo: string | null;
  courseId: number;
  course_name: string;
  mt_added_on: string;
}

interface MasterTrainerTableData extends MasterTrainerApiData {
  id: number; // For DynamicTable compatibility
}

interface MasterTrainerTableData extends MasterTrainerApiData {
  id: number;
}
const BACKEND_URL = "http://localhost:5000"; // adjust port as needed
const MasterTrainerTable: React.FC = () => {
  const [masterTrainers, setMasterTrainers] = useState<
    MasterTrainerTableData[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [columns, setColumns] = useState<Column[]>(
    DEFAULT_MASTER_TRAINER_COLUMNS
  );
  const [filterStatus, setFilterStatus] = useState<StudentStatus>("all");
  useEffect(() => {
    const fetchMasterTrainers = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getMasterTrainersProfile();
        if (!response.success) {
          throw new Error(response.message);
        }

        const mappedData: MasterTrainerTableData[] = response.data.map(
          (trainer: MasterTrainerApiData) => ({
            ...trainer,
            id: trainer.user_id,
          })
        );

        setMasterTrainers(mappedData);
      } catch (error) {
        console.error("Error fetching MasterTrainers:", error);
        setError(
          "Failed to fetch Master Trainer data. Please try again later."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchMasterTrainers();
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="w-full">
      <SettingsHeader
        SettingsHeader="Enrolled Master Trainers"
        SettingDescription="Enrolled Master Trainers Data"
      />
      <div className="mt-8">
        <DataTable
          data={masterTrainers}
          columns={columns}
          filterStatus={filterStatus}
          setColumns={setColumns}
          isActionBtn={false}
          onView={(item) => {}}
          onEdit={() => {}}
          onDelete={() => {}}
          photo="user_profile_photo"
        />
      </div>
    </div>
  );
};

export default MasterTrainerTable;
