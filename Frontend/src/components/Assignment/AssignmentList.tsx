import React, { useEffect, useState } from "react";
import { deleteAssignment, getAssignmentList } from "../../services/api";

import { useBatch } from "../../context/BatchContext";
import { DataTable } from "../AdmissionPortal/DataTable";
import { Column, FilterStatus } from "../../types/columns";
import {
  DEFAULT_ASSIGNMENT_COLUMNS,
  DEFAULT_COLUMNS,
} from "../../utils/tableUtils";
import SettingsHeader from "../Settings/SettingsHeader";

import AssignmentView from "./AssignmentView";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import AssignmentForm from "./AssignmentForm";
import AssignmentUpdate from "./AssignmentUpdate";

interface Assignment {
  as_id: number;
  as_title: string;
  as_description: string;
  as_attachment: string;
  as_deadline: string;
  as_deadline_formatted: string;
  as_marks: number;
  as_added_on: string;
  t_id: number;
  tb_id: number;
  course_id: number;
  center_id: number;
  course_name: string;
  center_name: string;
  tb_name: string;
  t_name: string;
  statistics?: {
    submissionCount: number;
    pendingCount: number;
    totalStudents: number;
    avgMarks: string;
  };
  studentStats?: {
    hasSubmitted: boolean;
    obtainedMarks: string | null;
    submissionStatus: number | null;
    submissionDate: string | null;
  };
}
function AssignmentList() {
  
  const { selectedBatchId } = useBatch();
  const { selectedBatchName } = useBatch();
  const [isSubmenuOpen, setIsSubmenuOpen] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [data, setData] = useState<Assignment[]>([]);
  const [viewData, setViewData] = useState<any>(null);
  const [columns, setColumns] = useState<Column[]>(DEFAULT_ASSIGNMENT_COLUMNS);
  const [userId, setUserId] = useState<number>(0);
  const [userType, setUserType] = useState<string>("");
  const [activeTab, setActiveTab] = useState("AssignmentList");
  const [isLoading, setIsLoading] = useState(false); // Add loading state
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<
    string | number | null
  >(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState<number | null>(
    null
  );
  const toggleSubmenu = (menu: string) => {
    setIsSubmenuOpen(isSubmenuOpen === menu ? null : menu);
  };
   const localAssignment = localStorage.getItem("assignmentDetails");
   
  interface UserData {
    id: number;
    name: string;
    username: string;
    type: string;
  }
  const { user_id } = useBatch();
  const getUserType = () => {
    try {
      const admin = localStorage.getItem(`admin${user_id}`);
      if (!admin) {
        console.log("No admin data found");
      }

      const parsedAdmin: UserData = admin ? JSON.parse(admin) : null;
      if (parsedAdmin?.id) {
        setUserId(parsedAdmin.id);
        setUserType(parsedAdmin.type);
      }
    } catch (error) {
      console.error("Error parsing admin data:", error);
    }
  };

  const fetchCandidateProfile = async () => {
    setIsLoading(true); // Set loading state to true before fetching data
    try {
      // Fetch fresh data if no cache or cache expired
      const response = await getAssignmentList(selectedBatchId, user_id);
      if (response.success) {
        const assignmentData = Array.isArray(response.data)
          ? response.data.map((assignment: any) => ({
              as_id: assignment.as_id,
              as_title: assignment.as_title,
              as_description: assignment.as_description,
              as_attachment: assignment.as_attachment,
              // Store both the original date string and formatted date
              as_deadline: assignment.as_deadline,
              as_deadline_formatted: new Date(
                assignment.as_deadline
              ).toLocaleDateString(),
              as_marks: assignment.as_marks,
              t_id: assignment.t_id,
              tb_id: assignment.tb_id,
              course_id: assignment.course_id,
              center_id: assignment.center_id,
              as_added_on: new Date(
                assignment.as_added_on
              ).toLocaleDateString(),
              course_name: assignment.Course?.course_name || "",
              center_name: assignment.Center?.center_name || "",
              tb_name: assignment.TrainingBatch?.tb_name || "",
              t_name: assignment.trainer?.user?.user_name || "", // Added trainer name
              // Pass through the statistics and student stats
              statistics: assignment.statistics,
              studentStats: assignment.studentStats,
            }))
          : [
              {
                as_id: response.data.as_id,
                as_title: response.data.as_title,
                as_description: response.data.as_description,
                as_attachment: response.data.as_attachment,
                // Store both the original date string and formatted date
                as_deadline: response.data.as_deadline,
                as_deadline_formatted: new Date(
                  response.data.as_deadline
                ).toLocaleDateString(),
                as_marks: response.data.as_marks,
                t_id: response.data.t_id,
                tb_id: response.data.tb_id,
                course_id: response.data.course_id,
                center_id: response.data.center_id,
                as_added_on: new Date(
                  response.data.as_added_on
                ).toLocaleDateString(),
                course_name: response.data.Course?.course_name || "",
                center_name: response.data.Center?.center_name || "",
                tb_name: response.data.TrainingBatch?.tb_name || "",
                t_name: response.data.trainer?.user?.user_name || "", // Added trainer name
                // Pass through the statistics and student stats
                statistics: response.data.statistics,
                studentStats: response.data.studentStats,
              },
            ];
        setData(assignmentData);
      }
    } catch (err) {
      console.error("Error fetching assignments:", err);
      setData([]);
    } finally {
      setIsLoading(false); // Set loading state to false after fetching data
    }
  };

  const deleteStudentAssignment = async (as_id: number) => {
    try {
      const response = await deleteAssignment(as_id);
      if (response.success) {
        // Clear the cache when an assignment is deleted
        const cacheKey = `assignmentList_${selectedBatchId}_${user_id}`;
        localStorage.removeItem(cacheKey);

        await fetchCandidateProfile();
        toast.success("Assignment deleted successfully");
      }
    } catch (err) {
      console.error("Error deleting assignment:", err);
      toast.error("Failed to delete assignment");
    } finally {
      setDeleteDialogOpen(false);
      setAssignmentToDelete(null);
    }
  };

  const handleDeleteClick = (as_id: number) => {
    setAssignmentToDelete(as_id);
    setDeleteDialogOpen(true);
  };

  useEffect(() => {
    if (user_id > 0) {
      getUserType();
      fetchCandidateProfile();
    }
    // Move this logic here:
   if(userType === "trainer") {
       const localAssignment = localStorage.getItem("assignmentDetails");
      if (localAssignment) {
        try {
          setActiveTab("AssignmentView");
        } catch (e) {
          setActiveTab("AssignmentList");
        }
      }
    }
    // eslint-disable-next-line
  }, [selectedBatchId, userId]);

  return (
    <>
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Assignment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this assignment? This action
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
            <Button
              variant="destructive"
              onClick={() =>
                assignmentToDelete &&
                deleteStudentAssignment(assignmentToDelete)
              }
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="h-screen mt-10 flex flex-col bg-[hsl(var(--background))]">
        {activeTab === "AssignmentList" && (
          <main className="flex-1 overflow-auto">
            <SettingsHeader
              SettingsHeader="Assignments List"
              SettingDescription="List of Assignments you submitted to your students."
            />
            {userType === "trainer" ? (
              <DataTable
                data={data}
                columns={columns}
                filterStatus={filterStatus}
                setColumns={setColumns}
                setFilterStatus={setFilterStatus}
                isActionBtn={true}
                isLoading={isLoading}
                onView={(item) => {
                  setViewData(item);
                  setActiveTab("AssignmentView");
                }}
                onEdit={(item) => {
                  setViewData(item);
                  setActiveTab("AssignmentForm");
                }}
                onDelete={(item) => {
                  handleDeleteClick(item.as_id);
                }}
              />
            ) : (
              <DataTable
                data={data}
                columns={columns}
                filterStatus={filterStatus}
                setColumns={setColumns}
                setFilterStatus={setFilterStatus}
                isActionBtn={true}
                isLoading={isLoading}
                onView={(item) => {
                  setViewData(item);
                  setActiveTab("AssignmentView");
                }}
              />
            )}
          </main>
        )}
        {activeTab === "AssignmentView" && (
          <AssignmentView
            assignment={viewData}
            setActiveTab={setActiveTab}
          />
        )}
        {activeTab === "AssignmentUpdate" && (
          <AssignmentUpdate assignment={viewData} setActiveTab={setActiveTab} />
        )}
        {activeTab === "AssignmentForm" && (
          <AssignmentForm mode="edit" initialData={viewData} />
        )}
      </div>
    </>
  );
}

export default AssignmentList;
