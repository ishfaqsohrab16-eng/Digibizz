import { useState, useEffect } from "react";
import { getStudentFeedBack } from "../../services/api";
import { DataTable } from "../AdmissionPortal/DataTable";
import { useBatch } from "../../context/BatchContext";
import { Column } from "../../types/columns";
import { toast } from "sonner";
import Loader from "../Loader";
import { Star } from "lucide-react";

const DEFAULT_COLUMNS: Column[] = [
  { id: "studentName", label: "Name", visible: true },
  { id: "centerName", label: "Center Name", visible: true },
  { id: "sf_date", label: "Date", visible: true },
  { id: "sf_month", label: "Month", visible: true },
  { id: "sf_lecture", label: "Lecture Quality", visible: true },
  { id: "sf_queries", label: "Query Resolution", visible: true },
  { id: "sf_knowledge", label: "Knowledge", visible: true },
  { id: "sf_punctuality", label: "Punctuality", visible: true },
  { id: "sf_lab_clean", label: "Lab Cleanliness", visible: true },
  { id: "sf_lab_internet", label: "Internet Quality", visible: true },
  { id: "sf_trainer_feedback", label: "Trainer Feedback", visible: true },
  { id: "sf_lab_feedback", label: "Lab Feedback", visible: true },
];

export function StudentFeedbackTable() {
  const [columns, setColumns] = useState<Column[]>(DEFAULT_COLUMNS);
  const [feedbackData, setFeedbackData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { selectedBatchId, user_id, userType } = useBatch();

  const getStarRating = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, index) => (
          <Star
            key={index}
            className={`h-4 w-4 ${
              index < rating
                ? "fill-yellow-400 text-yellow-400"
                : "fill-gray-200 text-gray-200"
            }`}
          />
        ))}
        <span className="ml-2 text-sm text-gray-600">{rating}/5</span>
      </div>
    );
  };

  const fetchFeedbackData = async () => {
    try {
      setIsLoading(true);
      const response = await getStudentFeedBack(
        selectedBatchId,
        user_id,
        userType
      );
      if (response.success) {
        setFeedbackData(
          response.data.map((item: any) => ({
            ...item,
            sf_lecture: getStarRating(item.sf_lecture),
            sf_queries: getStarRating(item.sf_queries),
            sf_knowledge: getStarRating(item.sf_knowledge),
            sf_punctuality: getStarRating(item.sf_punctuality),
            sf_lab_clean: getStarRating(item.sf_lab_clean),
            sf_lab_internet: getStarRating(item.sf_lab_internet),
          }))
        );
      } else {
        toast.error(response.message || "Failed to fetch feedback data");
      }
    } catch (error) {
      console.error("Error fetching feedback data:", error);
      toast.error("Failed to fetch feedback data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBatchId && user_id) {
      fetchFeedbackData();
    }
  }, [selectedBatchId, user_id]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader />
          <p className="text-sm text-muted-foreground">
            Loading feedback data...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <DataTable
        data={feedbackData}
        columns={columns}
        setColumns={setColumns}
        isLoading={isLoading}
      />
    </div>
  );
}

export default StudentFeedbackTable;
