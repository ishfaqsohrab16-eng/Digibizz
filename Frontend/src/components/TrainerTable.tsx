import React, { useState, useEffect } from "react";
import { getTrainersProfile, loginAsSubUser } from "../services/api";
import { useBatch } from "../context/BatchContext";
import { Column } from "../types/columns";
import { DEFAULT_TRAINER_COLUMNS } from "../utils/tableUtils";
import SettingsHeader from "./Settings/SettingsHeader";
import DataTable from "./AdmissionPortal/DataTable";
import { createSubUserSessionUrl } from "../utils/navigationUtils";

interface TrainerApiData {
  user_id: number;
  user_name: string;
  user_username: string;
  user_email: string;
  user_type: string;
  user_status: string;
  user_profile_photo: string;
  course_name: string;
  center_name: string;
}

interface TrainerTableData extends TrainerApiData {
  id: number;
}

const TrainerTable: React.FC = () => {
  const [trainers, setTrainers] = useState<TrainerTableData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { selectedBatchId, userType, user_id } = useBatch();
  const [columns, setColumns] = useState<Column[]>(DEFAULT_TRAINER_COLUMNS);

  const fetchTrainers = async () => {
    setLoading(true);
    setError(null);
    try {
      // Create cache key based on batch ID and user context
      // const cacheKey = `trainersProfile_${selectedBatchId}_${user_id}_${userType}`;

      // // Check if we have cached data
      // const cachedData = localStorage.getItem(cacheKey);
      // if (cachedData) {
      //   const parsedData = JSON.parse(cachedData);
      //   // Check if cache is still valid (less than 1 hour old)
      //   const cacheTime = parsedData.timestamp || 0;
      //   const now = Date.now();
      //   if (now - cacheTime < 60 * 60 * 1000) {
      //     setTrainers(parsedData.trainers);
      //     setLoading(false);
      //     return;
      //   }
      // }

      // Fetch fresh data if no cache or cache expired
      const response = await getTrainersProfile(
        selectedBatchId,
        0,
        user_id,
        userType
      );

      const mappedData: TrainerTableData[] = response.data.map(
        (trainer: TrainerApiData) => ({
          ...trainer,
          id: trainer.user_id,
          user_type:
            trainer.user_type.charAt(0).toUpperCase() +
            trainer.user_type.slice(1),
          user_status: trainer.user_status === "1" ? "Active" : "Inactive",
          center_name: trainer.center_name || "N/A",
        })
      );

      // // Save to cache with timestamp
      // localStorage.setItem(
      //   cacheKey,
      //   JSON.stringify({
      //     trainers: mappedData,
      //     timestamp: Date.now(),
      //   })
      // );

      setTrainers(mappedData);
    } catch (error) {
      console.error("Error fetching Trainers:", error);
      setError("Failed to fetch Trainer data. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrainers();
  }, [selectedBatchId]);

  const loginAsTrainer = async (trainer: TrainerTableData) => {
    // Open a blank window synchronously to avoid popup blockers in Safari
    const win = window.open("about:blank", "_blank");
    try {
      // Call API to create login session for the trainer
      const login = await loginAsSubUser(trainer.user_id, selectedBatchId);

      if (login.success) {
        // Use our utility to create a properly formatted sub-user session URL
        const loginUrl = createSubUserSessionUrl(trainer.user_id);

        if (win) {
          win.location.href = loginUrl;
        }
      } else {
        if (win) {
          win.close();
        }
        console.error("Login failed");
      }
    } catch (error) {
      if (win) {
        win.close();
      }
      console.error("Error during login:", error);
    }
  };

  return (
    <div className="w-full overflow-x-auto">
      <SettingsHeader
        SettingsHeader="Enrolled Trainers"
        SettingDescription="Enrolled Trainers Data"
      />
      <div className="text-gray-600 leading-relaxed mb-6">
        <DataTable
          data={trainers}
          columns={columns}
          setColumns={setColumns}
          isActionBtn={true}
          isLoading={loading}
          onEmail={(item) => {}}
          onLogin={(item) => loginAsTrainer(item)}
          photo="user_profile_photo"
          logInAsSubUser="Login As Trainer"
        />
      </div>
    </div>
  );
};

export default TrainerTable;
