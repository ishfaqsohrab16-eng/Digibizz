import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/button";
import { useBatch } from "../../../context/BatchContext";
import {
  getEarnings,
  getStudentLeave,
  getStudentLeaveAsTrainer,
} from "../../../services/api";
import {
  DEFAULT_EARNINGS_COLUMNS,
  DEFAULT_STUDENT_LEAVE_COLUMNS,
} from "../../../utils/tableUtils";
import { Column } from "../../../types/columns";
import { DataTable } from "../../../components/AdmissionPortal/DataTable";
import ViewStudentLeave from "./ViewStudentLeave";
import { StudentLeaveFormDataToView } from "../../../types/leave";
import { toast } from "sonner";
import SettingsHeader from "../../Settings/SettingsHeader";
interface StudentLeaveTableData {
  sl_subject: string;
  sl_code: string;
  std_cnic: string;
  sl_submit_date: string;
  sl_status: string;
  tb_name: string;
  center_name: string;
  course_name: string;
}

export default function StudentLeaveTable({
  openForm,
  setViewStudentLeave,
}: {
  openForm: (formName: string) => void;
  setViewStudentLeave: (item: StudentLeaveFormDataToView[]) => void;
}) {
  const { selectedBatchId, center_id, course_id, user_id, userType } =
    useBatch();

  const [data, setData] = useState<StudentLeaveTableData[]>([]);
  const [response, setResponse] = useState<StudentLeaveFormDataToView[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [columns, setColumns] = useState<Column[]>(
    DEFAULT_STUDENT_LEAVE_COLUMNS
  );

  useEffect(() => {
    const fetchEarnings = async () => {
      try {
        let response;
        if (userType === "student") {
          response = await getStudentLeave(user_id);
        } else {
          response = await getStudentLeaveAsTrainer(user_id, selectedBatchId);
        }
        setResponse(response);

        if (response.message === "Trainer not found") {
          toast.error(response.message);
          setData([]);
          setResponse([]);
          return;
        }

        if (Array.isArray(response)) {
          const formattedData = response.map((item) => ({
            sl_code: item.sl_code,
            std_cnic: item.std_cnic,
            sl_subject: item.sl_subject,
            sl_submit_date: item.sl_submit_date,
            sl_status:
              item.sl_status === 0
                ? "Pending"
                : item.sl_status === 1
                ? "Approved"
                : "Rejected",
            tb_name: item.training_batches.tb_name,
            center_name: item.centers.center_name,
            course_name: item.courses.course_name,
          }));
          const formattedDataToView = response.map((item) => ({
            sl_code: item.sl_code,
            std_cnic: item.std_cnic,
            sl_subject: item.sl_subject,
            sl_submit_date: item.sl_submit_date,
            sl_status:
              item.sl_status === 0
                ? "Pending"
                : item.sl_status === 1
                ? "Approved"
                : "Rejected",
            course_name: item.courses.course_name,
            center_name: item.centers.center_name,
            tb_name: item.training_batches.tb_name,
            sl_body: item.sl_body,
            sl_trainer_comments: item.sl_trainer_comments,
            sl_month: item.sl_month,
            sl_date: item.sl_date,
          }));
          setResponse(formattedDataToView);
          setData(formattedData);
        }
      } catch (e) {
        console.error("Error fetching data:", e);
      }
    };

    fetchEarnings();
  }, [selectedBatchId]);
  const getDataBySlCNIC = (sl_code: string) => {
    if (Array.isArray(response)) {
      const filteredData = response
        .filter((item) => item.sl_code === sl_code)

        .map((item) => ({
          sl_code: item.sl_code,
          std_cnic: item.std_cnic,
          sl_subject: item.sl_subject,
          sl_submit_date: item.sl_submit_date,
          sl_status: item.sl_status,
          course_name: item.course_name,
          center_name: item.center_name,
          tb_name: item.tb_name,
          sl_body: item.sl_body,
          sl_trainer_comments: item.sl_trainer_comments,
          sl_month: item.sl_month,
          sl_date: item.sl_date,
        }));

      setViewStudentLeave(filteredData);
    }
  };

  return (
    <div className="max-w-full mx-auto p-3 sm:p-4 lg:p-6 bg-[hsl(var(--card))] rounded-lg shadow-[hsl(var(--border))] overflow-x-auto">
      <SettingsHeader
        SettingsHeader="Student Leaves"
        SettingDescription="List of Student Leaves"
      />
      {userType === "student" && (
        <div className="mb-4">
          <Button
            className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)] text-[hsl(var(--primary-foreground))] w-full sm:w-auto text-sm sm:text-base px-4 py-2"
            onClick={() => openForm("StudentLeaveForm")}
          >
            Add Leave
          </Button>
        </div>
      )}
      {errorMessage && (
        <div className="error-message mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
          {errorMessage}
        </div>
      )}
      {/* Render your data here */}
      <div className="overflow-x-auto">
        {userType === "student" ? (
          <DataTable
            data={data}
            columns={columns}
            setColumns={setColumns}
            isActionBtn={true}
            onView={(item) => {
              getDataBySlCNIC(item.sl_code);
              openForm("ViewStudentLeave");
            }}
          />
        ) : (
          <>
            {userType === "trainer" ? (
              <DataTable
                data={data}
                columns={columns}
                setColumns={setColumns}
                isActionBtn={true}
                onView={(item) => {
                  getDataBySlCNIC(item.sl_code);
                  openForm("ViewStudentLeave");

                }}
              />
            ) : (
              <DataTable
                data={data}
                columns={columns}
                setColumns={setColumns}
                isActionBtn={false}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
