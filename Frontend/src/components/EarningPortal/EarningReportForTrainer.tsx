import { EarningsData, EarningsTableRow } from "../../types/earningFormData";
import { Card, CardContent } from "../ui/card";
import { Wallet } from "lucide-react";
import {
  DEFAULT_EARNINGS_SUBMISSIONS_COLUMNS,
  DEFAULT_FILTER_BY_EARNINGS_STATUS,
  DEFAULT_FILTER_BY_TRAINING_BATCH_STATUS,
} from "../../utils/tableUtils";
import { Column, FilterBy } from "../../types/columns";
import { useEffect, useState } from "react";
import { DataTable } from "../AdmissionPortal/DataTable";
import { getEarningsByTrainer } from "../../services/api";
import { useBatch } from "../../context/BatchContext";

const getStatusText = (status: number) => {
  switch (status) {
    case 0:
      return "Pending";
    case 1:
      return "Approved";
    case 2:
      return "Rejected";
    default:
      return "Unknown";
  }
};

export const EarningReportForTrainer = () => {
  const [columns, setColumns] = useState<Column[]>(
    DEFAULT_EARNINGS_SUBMISSIONS_COLUMNS
  );
  const [filterStatus, setFilterStatus] = useState<FilterBy[]>(
    DEFAULT_FILTER_BY_EARNINGS_STATUS
  );
  const [data, setData] = useState<any[]>([]);
  const { selectedBatchId, user_id } = useBatch();

  const fetchEarnings = async () => {
    try {
      const response = await getEarningsByTrainer(selectedBatchId, user_id);
      const mappedData = response.earnings.map((earning: any) => ({
        earningId: earning.earningId,
        studentId: earning.studentId,
        studentName: earning.studentName,
        studentImage: earning.studentImage,
        platform: earning.platform,
        amount: earning.amount,
        date: earning.date,
        status: getStatusText(earning.status),
        earningStatus: earning.earningStatus,
        proof: earning.proof,
        centerName: earning.centerName,
        courseName: earning.courseName,
        trainerName: earning.trainerName,
        trainerImage: earning.trainerImage,
        trainingBatchName: earning.trainingBatchName,
      }));
      setData(mappedData);
    } catch (error) {
      console.error("Error fetching earnings:", error);
      setData([]);
    }
  };
  useEffect(() => {
    if (selectedBatchId >= 0 && user_id > 0) {
      fetchEarnings();
    }
  }, [selectedBatchId, user_id]);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  return (
    <DataTable
      data={data}
      columns={columns}
      setColumns={setColumns}
      filterStatus={filterStatus}
      setFilterStatus={setFilterStatus}
      isActionBtn={false}
      isProofBtn={true}
      isEarningStatusBtn={false}
      photo="studentImage"
      onDownloadProof={(row) => {
        window.open(
          `${BACKEND_URL}${row.earning_proof}`,
          "_blank",
          "noopener,noreferrer"
        );
      }}
    />
  );
};
