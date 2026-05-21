import { useState, useEffect } from "react";
import { DataTable } from "../AdmissionPortal/DataTable";
import { ASSIGNMENT_SUBMISSION_COLUMNS } from "../../utils/tableUtils";
import { useBatch } from "../../context/BatchContext";
import {
  getAssignmentSubmissionsByBatch,
  updateAssignmentSubmission,
} from "../../services/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Loader2 } from "lucide-react"; // Import the loader icon
import { set } from "date-fns";

// Helper function to convert status number to text
const getStatusText = (status: number) => {
  switch (Number(status)) {
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

interface AssignmentSubmissionListProps {
  as_id: number;
  setActiveTab?: (tab: string) => void;
}

export const AssignmentSubmissionList = ({ as_id, setActiveTab }: AssignmentSubmissionListProps) => {
  const [columns, setColumns] = useState(ASSIGNMENT_SUBMISSION_COLUMNS);
  const [submittedData, setSubmittedData] = useState([]);
  const [notSubmittedData, setNotSubmittedData] = useState([]);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const { selectedBatchId, user_id,
        setSubmittedCount,
        setNotSubmittedCount,
        setTotalStudents } = useBatch();
  const [isMounted, setIsMounted] = useState(true);
  const [isLoading, setIsLoading] = useState(false); // Add loading state for the entire component
  const [downloadingId, setDownloadingId] = useState<string | number | null>(null);

  const fetchSubmissions = async (forceRefresh = false) => {
    if (!isMounted) return;

    setIsLoading(true); // Set loading state to true when fetching data

    try {
      const response = await getAssignmentSubmissionsByBatch(
        selectedBatchId,
        user_id,
        as_id
      );
      if (response.success) {
        // Transform the status values to readable text
        const formattedSubmissions = response.data.submitted.map((submission: any) => ({
          ...submission,
          status: getStatusText(submission.status),
        }));
        setSubmittedCount?.(response.data.submittedCount || 0);
        setNotSubmittedCount?.(response.data.pendingCount || 0);
        setTotalStudents?.(response.data.totalStudents || 0);
        setSubmittedData(formattedSubmissions);
        setNotSubmittedData(response.data.notSubmitted);

      }
    } catch (error) {
      if (isMounted) {
        console.error("Error fetching submissions:", error);
        toast.error("Failed to fetch submissions");
      }
    } finally {
      if (isMounted) {
        setIsLoading(false); // Always set loading state to false when done
      }
    }
  };

  useEffect(() => {
    setIsMounted(true);

    if (selectedBatchId && as_id) {
      // Always force a refresh when component mounts or dependencies change
      fetchSubmissions(true);
    }

    return () => {
      setIsMounted(false);
      // Clear the cache when component unmounts
      const submissionCacheKey = `assignmentSubmissions_${as_id}`;
      localStorage.removeItem(submissionCacheKey);
    };
  }, [selectedBatchId, as_id]);

  const handleView = (submission: any) => {
    setSelectedSubmission(submission);
    setViewDialogOpen(true);
  };

  const handleUpdateClick = (submission: any) => {
    if (isMounted) {
      setSelectedSubmission(submission);
      localStorage.setItem("selectedSubmission", JSON.stringify(submission));
      if (setActiveTab) {
        setActiveTab("AssignmentUpdate");
      }
    }
  };

  const handleDownloadProof = async (row: any) => {
    // Prevent multiple downloads of the same item
    if (downloadingId === row.submission_id) return;

    try {
      setDownloadingId(row.submission_id);

      // Check if URL is valid
      if (!row.submission_attachment) {
        throw new Error("No attachment available");
      }

      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";
      const fullUrl = row.submission_attachment.startsWith("http")
        ? row.submission_attachment
        : `${BACKEND_URL}${row.submission_attachment}`;

      // First check if the file exists
      const response = await fetch(fullUrl);
      if (!response.ok) {
        throw new Error("File not found");
      }

      // Then process the download
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      const fileName = row.submission_attachment.split("/").pop() || "download";
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success("Download started");
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Failed to download file");
    } finally {
      // Add a small delay before allowing another download
      setTimeout(() => {
        if (isMounted) {
          setDownloadingId(null);
        }
      }, 1000);
    }
  };

  return (
    <div className="space-y-8">
      {viewDialogOpen ? (
        <>
          {selectedSubmission && handleUpdateClick(selectedSubmission)}
        </>
      ) : (
        <>
          <div>
            <h2 className="text-xl font-semibold mb-4">Submitted Assignments</h2>
            
              <DataTable
                data={submittedData}
                columns={columns}
                setColumns={setColumns}
                isActionBtn={true}
                onView={handleView}
                isEarningStatusBtn={true}
                isLoading={isLoading}
                onDownloadProof={handleDownloadProof}
              />
   
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-4">Pending Submissions</h2>
          
              <DataTable
                data={notSubmittedData}
                columns={columns.filter(
                  (col) =>
                    ![
                      "submission_date",
                      "assignment_title",
                      "total_marks",
                      "obtained_marks",
                      "status",
                    ].includes(col.id)
                )}
                setColumns={setColumns}
                isLoading={isLoading}
              />
         
          </div>
        </>
      )}
    </div>
  );
};
