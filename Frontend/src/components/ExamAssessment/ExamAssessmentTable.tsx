import React, { useState, useEffect } from "react";
import { getExamAssessments, deleteExamAssessment, getExamAssessmentAll } from "../../services/api";
import { useBatch } from "../../context/BatchContext";
import { DataTable } from "../../components/AdmissionPortal/DataTable";
import { Column, FilterBy, FilterStatus } from "../../types/columns";
import {
  DEFAULT_EXAM_ASSESSMENT_COLUMNS,
  DEFAULT_FILTER_BY_EXAM_TYPE,
} from "../../utils/tableUtils";
import SettingsHeader from "../../components/Settings/SettingsHeader";
import { Button } from "../../components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  ExamAssessment,
  ExamAssessmentWithRelations,
} from "../../types/examAssessment";
import MasterReportDashboard from "./MasterReportDashboard";

interface ExamAssessmentTableProps {
  openForm: (formName: string) => void;
  setSelectedAssessmentId?: (id: number) => void;
  studentCnic?: string;
  type: string; // Default to 'all' if not provided
}

const ExamAssessmentTable: React.FC<ExamAssessmentTableProps> = ({
  openForm,
  setSelectedAssessmentId,
  studentCnic = "",
  type, // Default to 'all' if not provided
}) => {
  const { selectedBatchId, userType, user_id } = useBatch();
  const [assessmentData, setAssessmentData] = useState<
    ExamAssessmentWithRelations[]
  >([]);
  const [columns, setColumns] = useState<Column[]>(
    DEFAULT_EXAM_ASSESSMENT_COLUMNS
  );
  const [filterType, setFilterType] = useState<FilterStatus>("all");
  const [filterBy] = useState<FilterBy[]>(DEFAULT_FILTER_BY_EXAM_TYPE);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assessmentToDelete, setAssessmentToDelete] = useState<number | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<'all' | 'graduates' | 'MasterReport'>('all');
  // Add a cache ref to store responses by batch ID
  const assessmentCache = React.useRef<
    Record<string, ExamAssessmentWithRelations[]>
  >({});

  // Format data for the table
  const processAssessmentData = (
    assessments: ExamAssessmentWithRelations[]
  ): any[] => {
    return assessments.map((assessment) => ({
      ea_id: assessment.ea_id,
      std_cnic: assessment.std_cnic,
      user_name: assessment?.student?.user?.user_name || "N/A",
      phoneNumber: assessment?.student?.std_phone || "N/A",
      std_gender: assessment?.student?.std_gender || "N/A",
      std_earing: assessment?.student?.totalEarnings || "N/A",
      std_fathername: assessment?.student?.std_fathername,
      ea_type: assessment.ea_type,
      class_participation: assessment.class_participation,
      final_task: assessment.final_task,
      presentation: assessment.presentation,
      viva: assessment.viva,
      total_score: assessment.total_score,
      remarks: assessment.remarks,
      center_name: assessment.centers?.center_name || "",
      course_name: assessment.courses?.course_name || "",
      batch_name: assessment.training_batches?.tb_name || "",
      center_id: assessment.center_id,
      course_id: assessment.course_id,
      tb_id: assessment.tb_id,
      special_case: assessment?.student?.special_case || "N/A",
      lms_status: assessment?.student?.std_lms_status || "N/A",
      status:
        assessment.ea_type === "MID"
          ? Number(assessment.total_score) >= 15
            ? "PASS"
            : "FAIL"
          : Number(assessment.total_score) >= 60
          ? "PASS"
          : "FAIL",
    }));
  };

  const fetchAssessmentData = async () => {
    setIsLoading(true);
    try {
      // // Create a consistent cache key format including batch ID
      // const batchIdKey = `examAssessments_${selectedBatchId}`;

      // // Check if we have cached data for this batch ID
      // // if (assessmentCache.current[batchIdKey]) {
      // //   // Use cached data if available
      // //   const processedData = processAssessmentData(
      // //     assessmentCache.current[batchIdKey]
      // //   );
      // //   setAssessmentData(processedData);
      // //   setIsLoading(false);
      // //   return;
      // // }

      // Otherwise fetch from API
      const cnic = studentCnic || "";
      let response;
      if(activeTab === "MasterReport"){
        response = await getExamAssessmentAll();
      }else{
       response = await getExamAssessments(
        selectedBatchId,
        userType,
        user_id,
        type
      );
    }
      if (response.success) {
       console.log("Fetched assessment data:", response.data);

        let processedData = processAssessmentData(response.data);
        if (type === "MID") {
          processedData = processedData.map((item) => ({
            ...item,
            total_score:
              Number(item.class_participation || 0) +
              Number(item.final_task || 0) +
              Number(item.presentation || 0),
          }));
        }
        
        // Filter data based on active tab for FINAL type
        if (type === "FINAL" && activeTab === "graduates") {
          console.log("Filtering graduates", processedData);
          processedData = processedData.filter((item) => item.status === "PASS" && item.lms_status === 1 && item.special_case === "0");
        }
        
        setAssessmentData(processedData);
        console.log(assessmentData);
      } else {
        setAssessmentData([]);
        toast.error("Failed to fetch exam assessments");
      }
    } catch (error) {
      console.error("Error fetching exam assessments:", error);
      toast.error("An error occurred while fetching data");
      setAssessmentData([]);
    } finally {
      setIsLoading(false);
    }
  };

  // // Clear the cache entry when an assessment is deleted or updated
  // const invalidateCache = () => {
  //   if (selectedBatchId) {
  //     // Use the same consistent key format
  //     const batchIdKey = `examAssessments_${selectedBatchId}`;
  //     delete assessmentCache.current[batchIdKey];
  //   }
  // };

  useEffect(() => {
    if (selectedBatchId >= 0) {
      fetchAssessmentData();
    }
  }, [selectedBatchId, user_id, activeTab]);

  // We also need to save cache to localStorage for persistence between sessions
  useEffect(() => {
    // Load cache from localStorage on component mount
    try {
      const savedCache = localStorage.getItem("examAssessmentCache");
      if (savedCache) {
        assessmentCache.current = JSON.parse(savedCache);
      }
    } catch (error) {
      console.error("Error loading cache from localStorage:", error);
    }

    // Save cache to localStorage when component unmounts
    return () => {
      try {
        localStorage.setItem(
          "examAssessmentCache",
          JSON.stringify(assessmentCache.current)
        );
      } catch (error) {
        console.error("Error saving cache to localStorage:", error);
      }
    };
  }, []);

  const handleDeleteClick = (id: number) => {
    setAssessmentToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!assessmentToDelete) return;

    try {
      const response = await deleteExamAssessment(assessmentToDelete);

      if (response.success) {
        toast.success("Exam assessment deleted successfully");
        // invalidateCache(); // Clear the cache before fetching new data
        // Update localStorage after cache invalidation
        try {
          localStorage.setItem(
            "examAssessmentCache",
            JSON.stringify(assessmentCache.current)
          );
        } catch (error) {
          console.error("Error updating localStorage cache:", error);
        }
        fetchAssessmentData(); // Refresh data
      } else {
        toast.error(response.message || "Failed to delete assessment");
      }
    } catch (error) {
      console.error("Error deleting assessment:", error);
      toast.error("An error occurred while deleting the assessment");
    } finally {
      setDeleteDialogOpen(false);
      setAssessmentToDelete(null);
    }
  };

  const handleEditAssessment = (assessment: ExamAssessmentWithRelations) => {
    if (setSelectedAssessmentId) {
      setSelectedAssessmentId(assessment.ea_id);
    }
    openForm("ExamAssessmentEdit");
  };

  useEffect(() => {
    // Dynamically hide "Viva" column for MID type
    if (type === "MID") {
      setColumns(
        DEFAULT_EXAM_ASSESSMENT_COLUMNS.filter((col) => col.id !== "viva")
      );
    } else {
      setColumns(DEFAULT_EXAM_ASSESSMENT_COLUMNS);
    }
  }, [type]);

  return (
    <>
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Exam Assessment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this exam assessment? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="max-w-8xl mx-auto p-6 bg-white rounded-lg shadow-md">
        <SettingsHeader
          SettingsHeader="Exam Assessments"
          SettingDescription="Manage student examination assessments"
        />

        {/* <div className="flex justify-between items-center mb-6">
          <Button
            onClick={() => openForm("ExamAssessmentCreate")}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Exam Assessment
          </Button>
        </div> */}

        {/* Navigation Tabs for FINAL type */}
        {type === "FINAL" && (
          <div className="mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'all'
                      ? 'border-emerald-500 text-emerald-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Final Exam List
                </button>
                <button
                  onClick={() => setActiveTab('graduates')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'graduates'
                      ? 'border-emerald-500 text-emerald-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Graduates
                </button>
                 <button
                  onClick={() => setActiveTab('MasterReport')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'MasterReport'
                      ? 'border-emerald-500 text-emerald-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Master Report
                </button>
              </nav>
            </div>
          </div>
        )}

        {/* Render Master Report Dashboard when MasterReport tab is active */}
        {activeTab === 'MasterReport' && type === "FINAL" ? (
          <MasterReportDashboard />
        ) : (
          <>
            {userType === "SuperAdmin" ? (
              <DataTable
                data={assessmentData}
                columns={columns}
                filterStatus={filterType}
                setColumns={setColumns}
                setFilterStatus={setFilterType}
                isActionBtn={true}
                filterBy={filterBy}
                isLoading={isLoading}
                onView={(item) => {
                  if (setSelectedAssessmentId) {
                    setSelectedAssessmentId(item.ea_id);
                  }
                  localStorage.setItem(
                    "selectedAssessmentId",
                    item.ea_id.toString()
                  );
                  openForm("ExamAssessmentView");
                }}
                onDelete={(item) => handleDeleteClick(item.ea_id)}
              />
            ) : (
              <DataTable
                data={assessmentData}
                columns={columns}
                filterStatus={filterType}
                setColumns={setColumns}
                setFilterStatus={setFilterType}
                isActionBtn={true}
                filterBy={filterBy}
                isLoading={isLoading}
              />
            )}
          </>
        )}
      </div>
    </>
  );
};

export default ExamAssessmentTable;
