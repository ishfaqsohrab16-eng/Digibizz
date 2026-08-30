import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/button";
import { useBatch } from "../../../context/BatchContext";
import { DEFAULT_TRAINER_LEAVE_COLUMNS } from "../../../utils/tableUtils";
import { Column } from "../../../types/columns";

import { DataTable } from "../../../components/AdmissionPortal/DataTable";
import { toast } from "sonner";
import {
  getTrainerLeave,
  getTrainerLeaveAsMTOrAdmin,
} from "../../../services/api";
import { Plus } from "lucide-react";
import SettingsHeader from "../../Settings/SettingsHeader";

interface TrainerLeaveTableProps {
  openForm: (formName: string) => void;
  setViewTrainerLeave: (data: any[]) => void;
}

export default function TrainerLeaveTable({
  openForm,
  setViewTrainerLeave,
}: TrainerLeaveTableProps) {
  const { selectedBatchId, user_id, userType } = useBatch();

  const [data, setData] = useState<{ tl_code: string; [key: string]: any }[]>(
    []
  );
  const [response, setResponse] = useState<
    { tl_code: string; [key: string]: any }[]
  >([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [columns, setColumns] = useState<Column[]>(
    DEFAULT_TRAINER_LEAVE_COLUMNS
  );
  const fetchTrainerLeaves = async () => {
    try {
      let apiResponse;
      if (userType === "trainer") {
        apiResponse = await getTrainerLeave(user_id, selectedBatchId);
      } else {
        apiResponse = await getTrainerLeaveAsMTOrAdmin(
          user_id,
          selectedBatchId,
          userType
        );
      }

      if (!apiResponse || !apiResponse.data) {
        toast.error("Invalid response from server");
        setData([]);
        return;
      }

      if (apiResponse.message === "Trainer not found") {
        toast.error(apiResponse.message);
        setData([]);
        return;
      }

      const formattedData = apiResponse.data.map((item: any) => {
        // Get trainer's user_id from item.trainers
        const trainerUser = apiResponse.userTrainer.find(
          (user: any) => user.user_id === item.trainers.user_id
        );

        return {
          t_id: item.t_id,
          tl_code: item.tl_code,
          tl_subject: item.tl_subject,
          tl_submit_date: item.tl_submit_date,
          tl_status:
            item.tl_status === 0
              ? "Pending"
              : item.tl_status === 1
              ? "MT Approved"
              : item.tl_status === 2
              ? "MT Rejected"
              : item.tl_status === 3
              ? "Admin Approved"
              : "Admin Rejected",

          course_name: item.courses.course_name,
          center_name: item.centers.center_name,
          tb_name: item.training_batches.tb_name,
          tl_body: item.tl_body,
          tl_mt_comments: item.tl_mt_comments,
          tl_admin_comments: item.tl_admin_comments,
          tl_month: item.tl_month,
          tl_date: item.tl_date,
          t_name: trainerUser ? trainerUser.user_name : "Unknown", // Correct lookup
        };
      });

      setResponse(formattedData);
      setData(formattedData);
    } catch (error) {
      console.error("Error fetching trainer leaves:", error);
      // Show the server's reason rather than a generic line - "Trainer profile
      // not found" and a network failure need different responses from staff.
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Failed to fetch trainer leaves.";
      setErrorMessage(message);
      setData([]);
    }
  };

  useEffect(() => {
    // user_id and userType arrive from BatchContext one render after mount.
    // Firing before then sent user_id=0, got a 404, and never retried because
    // the effect ignored those two values - the table stayed empty even though
    // the trainer had leaves.
    if (!user_id || !userType) return;
    if (!selectedBatchId || selectedBatchId === -1) return;
    fetchTrainerLeaves();
  }, [selectedBatchId, user_id, userType]);

  const getDataByTlCode = (tl_code: string) => {
    if (!response || !Array.isArray(response)) {
      console.error("Response is not an array or is undefined:", response);
      return;
    }

    const filteredData = response.filter((item) => item.tl_code === tl_code);

    if (filteredData.length === 0) {
      console.warn("No matching data found for tl_code:", tl_code);
    }

    setViewTrainerLeave(filteredData);
  };
  return (
    <div className="max-w-8xl mx-auto p-6 bg-[hsl(var(--card))] rounded-lg shadow-[hsl(var(--border))]">
      <SettingsHeader
        SettingsHeader="Trainer Leaves"
        SettingDescription="List of Trainer Leaves"
      />
      {userType === "trainer" && (
        <Button
          className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)] text-[hsl(var(--primary-foreground))] font-medium px-4 py-2 rounded-lg shadow-md transform transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] mb-6"
          onClick={() => openForm("TrainerLeaveForm")}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Leave
        </Button>
      )}
      {errorMessage && <div className="error-message">{errorMessage}</div>}
      {/* Render your data here */}
      {userType === "trainer" ? (
        <DataTable
          data={data}
          columns={columns}
          setColumns={setColumns}
          isActionBtn={true}
          onView={(item) => {
            getDataByTlCode(item.tl_code);
            openForm("ViewTrainerLeave");
          }}
        />
      ) : (
        <>
          {(userType === "MasterTrainer" ||
            userType === "ContentAdmin" ||
            userType === "SuperAdmin") && (
            <DataTable
              data={data}
              columns={columns}
              setColumns={setColumns}
              isActionBtn={true}
              onView={(item) => {
                getDataByTlCode(item.tl_code);
                openForm("ViewTrainerLeave");
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
