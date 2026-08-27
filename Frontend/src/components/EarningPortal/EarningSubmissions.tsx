import {
  DEFAULT_EARNINGS_SUBMISSIONS_COLUMNS,
  DEFAULT_FILTER_BY_EARNINGS_STATUS,
} from "../../utils/tableUtils";
import { Column, FilterBy } from "../../types/columns";
import { useEffect, useState } from "react"; // add useRef
import { toast } from "sonner";
import { updateEarningStatus } from "../../services/api";
import RejectEarningDialog from "./RejectEarningDialog";
import { useBatch } from "../../context/BatchContext";
import { DataTable } from "../AdmissionPortal/DataTable";

export const EarningSubmissions = ({ data }: { data: any }) => {
  const [columns, setColumns] = useState<Column[]>(
    DEFAULT_EARNINGS_SUBMISSIONS_COLUMNS
  );
  const [filterStatus, setFilterStatus] = useState<FilterBy[]>(
    DEFAULT_FILTER_BY_EARNINGS_STATUS
  );
  const [filterBy, setFilterBy] = useState<FilterBy[]>(
    DEFAULT_FILTER_BY_EARNINGS_STATUS
  );
  const { selectedBatchId } = useBatch();

  // Store page numbers for each batch
  const [batchPages, setBatchPages] = useState<{ [batchId: string]: number }>(() => {
    const stored = localStorage.getItem("batchPages");
    return stored ? JSON.parse(stored) : {};
  });

  // Get current page for selected batch
  const currentPage = batchPages[selectedBatchId] || 1;

  // Update localStorage whenever batchPages changes
  useEffect(() => {
    localStorage.setItem("batchPages", JSON.stringify(batchPages));
  }, [batchPages]);

  // When selectedBatchId changes, ensure a page is set for it
  useEffect(() => {
    if (!batchPages[selectedBatchId]) {
      setBatchPages((prev) => ({ ...prev, [selectedBatchId]: 1 }));
    }
  }, [selectedBatchId]);

  // Function to set current page for the selected batch
  const setCurrentPage = (page: number) => {
    setBatchPages((prev) => ({ ...prev, [selectedBatchId]: page }));
  };

  const { setEarningStatus } = useBatch();
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  console.log("selectedBatchId: ",selectedBatchId)

  // When selectedBatchId changes, reset currentPage to stored value or 1
  useEffect(() => {
    const stored = localStorage.getItem(`currentPage-${selectedBatchId}`);
    setCurrentPage(stored ? parseInt(stored, 10) : 1);
  }, [selectedBatchId]);

  // Store currentPage in localStorage when it changes
  useEffect(() => {
    localStorage.setItem(`currentPage-${selectedBatchId}`, currentPage.toString());
    console.log("Current page set to:", currentPage);
  }, [currentPage, selectedBatchId]);

  // Rejecting opens a dialog first: the student is shown the reason, so one
  // is required rather than optional.
  const [rejecting, setRejecting] = useState<any | null>(null);

  const applyStatus = async (
    row: any,
    status: number,
    reason?: string
  ): Promise<boolean> => {
    try {
      const response = await updateEarningStatus(row.earningId, status, reason);

      if (response?.success) {
        setEarningStatus(response.earningStatus);
        toast.success(
          response.message ||
            (status === 1 ? "Submission approved" : "Submission rejected")
        );
        return true;
      }

      toast.error(response?.message || "Could not update the status");
      return false;
    } catch (err: any) {
      // Surface the server's own message - it explains WHY, e.g. a missing
      // reason - instead of a generic failure the reviewer cannot act on.
      const message =
        err?.response?.data?.message ||
        (err instanceof Error ? err.message : "Could not update the status");
      console.error("Error updating earning status:", err);
      toast.error(message);
      return false;
    }
  };

  const handleEarningStatusChange = async (row: any, status: string) => {
    if (status === "rejected") {
      setRejecting(row);
      return;
    }
    if (status === "approved") {
      await applyStatus(row, 1);
    }
  };

  return (
    <>
    <RejectEarningDialog
      submission={rejecting}
      onCancel={() => setRejecting(null)}
      onConfirm={async (reason) => {
        const ok = await applyStatus(rejecting, 2, reason);
        if (ok) setRejecting(null);
      }}
    />
    <DataTable
      data={data} // Always use parent data
      columns={columns}
      setColumns={setColumns}
      filterStatus={filterStatus}
      setFilterStatus={setFilterStatus}
      filterBy={filterBy}
      isActionBtn={false}
      isProofBtn={true}
      isEarningStatusBtn={true}
      isEarningStatusChangedBtn={data.earningStatus}
      photo="studentImage"
      onDownloadProof={(row) => {
        window.open(
          `${BACKEND_URL}${row.proof}`,
          "_blank",
          "noopener,noreferrer"
        );
      }}
      onEarningStatusChange={handleEarningStatusChange}
      currentPage={currentPage}
      setCurrentPage={setCurrentPage}
    />
    </>
  );
};
