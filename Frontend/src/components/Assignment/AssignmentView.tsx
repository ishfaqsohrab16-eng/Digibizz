import { useState, useEffect } from "react";
import DeadlineTimer from "./DeadlineTimer";
import StatisticsPanel from "./StatisticsPanel";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { toast } from "sonner";
import SettingsHeader from "../Settings/SettingsHeader";
import { AssignmentData } from "../../types/columns";
import TrainerStatisticsPanel from "./TrainerStatisticsPanel";
import { Loader2 } from "lucide-react";
import {
  getStudendByUserId,
  submitStudentAssignement,
  getStudentAssignmentSubmits,
} from "../../services/api";
import { AssignmentSubmissionList } from "./AssignmentSubmissionList";
import CustomCKEditor from "./CustomCKEditor";
import { useBatch } from "../../context/BatchContext";
import { Assignment } from "../StudentForm/StudentProfile";
import { set } from "date-fns";

interface AssignmentViewProps {
  assignment?: any;
  setActiveTab?: (tab: string) => void; // Make it optional with the correct function type
  openForm?: (formName: string, assignment?: Assignment) => void; // updated signature
}

interface AssignmentSubmission {
  std_rollno: string;
  tb_id: number;
  center_id: number;
  course_id: number;
  as_id: number;
  as_submission_comment: string;
  as_submission_attachment?: File;
  submitted_on?: string;
  as_submission_status?: number;
  obt_marks?: string;
}

// Add this helper function near the top of your component
const isDeadlinePassed = (deadline: string) => {
  try {
    if (typeof deadline === "string" && !deadline.includes("T")) {
      return false;
    }

    if (deadline.includes("T") && deadline.length === 16) {
      const match = deadline.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);

      if (match) {
        const [_, yearStr, monthStr, dayStr, hourStr, minuteStr] = match;
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10) - 1;
        const day = parseInt(dayStr, 10);
        const hour = parseInt(hourStr, 10);
        const minute = parseInt(minuteStr, 10);

        const deadlineDate = new Date(year, month, day, hour, minute);
        if (!isNaN(deadlineDate.getTime())) {
          const currentDate = new Date();
          return currentDate > deadlineDate;
        }
      }
    }

    // Fallback
    const deadlineDate = new Date(deadline);
    if (isNaN(deadlineDate.getTime())) {
      console.error("Invalid deadline format:", deadline);
      return true; // Treat invalid deadlines as passed
    }

    const currentDate = new Date();
    return currentDate > deadlineDate;
  } catch (error) {
    console.error("Error checking deadline:", error);
    return true; // Treat errors as deadlines passed
  }
};

// Add this helper function near the top of your component
const formatDeadlineDate = (deadline: string) => {
  try {
    if (typeof deadline === "string" && !deadline.includes("T")) {
      return deadline;
    }

    if (typeof deadline === "string") {
      const match = deadline.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);

      if (match) {
        const [_, yearStr, monthStr, dayStr, hourStr, minuteStr] = match;
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10) - 1;
        const day = parseInt(dayStr, 10);
        const hour = parseInt(hourStr, 10);
        const minute = parseInt(minuteStr, 10);

        const date = new Date(year, month, day, hour, minute);

        if (!isNaN(date.getTime())) {
          return new Intl.DateTimeFormat("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }).format(date);
        }
      }
    }

    // Fallback to standard date parsing
    const date = new Date(deadline);
    if (!isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    }

    console.error("Invalid date format in formatDeadlineDate:", deadline);
    return deadline || "Unknown Date"; // Return the original string if we can't parse it
  } catch (error) {
    console.error("Error formatting deadline date:", error, deadline);
    return deadline || "Unknown Date";
  }
};

const AssignmentView: React.FC<AssignmentViewProps> = ({
  assignment,
  setActiveTab,
}) => {

  if (!assignment) {
    const localAssignment = localStorage.getItem("assignmentDetails");
    if (localAssignment) {
      try {
        assignment = JSON.parse(localAssignment);
      } catch (e) {
        assignment = undefined;
      }
    }
  }
  if (!assignment) {
    return <div>Didn't Find Any Assignment Data</div>;
  }
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isdeadlineExpired, setIsdeadlineExpired] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const studentInfo = JSON.parse(localStorage.getItem("studentInfo") || "{}");
  const { rollNumber, name } = studentInfo;
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const { submittedCount, userType } = useBatch();
  const { notSubmittedCount } = useBatch();
  const { totalStudents } = useBatch();
  const {  user_id } = useBatch();
  const [formData, setFormData] = useState<AssignmentSubmission>({
    std_rollno: rollNumber,
    tb_id: assignment.tb_id,
    center_id: assignment.center_id,
    course_id: assignment.course_id,
    as_id: assignment.as_id,
    as_submission_comment: "",
    submitted_on: undefined,
    as_submission_status: undefined,
    obt_marks: assignment.as_marks || "",
  });
  const [isDownloading, setIsDownloading] = useState(false);
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        // 20MB limit
        toast.error("File too large. Please select a file smaller than 20MB.");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isdeadlineExpired) {
      toast.error(
        "Submission Failed. The deadline for this assignment has expired."
      );
      return;
    }

    if (!formData.std_rollno || formData.std_rollno === "undefined") {
      toast.error("Student roll number is missing. Please refresh the page.");
      return;
    }

    if (!formData.as_submission_comment.trim()) {
      toast.error("Submission Failed. Please provide a submission comment.");
      return;
    }

    if (selectedFile && selectedFile.size > 5 * 1024 * 1024) {
      toast.error(
        "Submission Failed. The file size exceeds the 5 MB limit. Please upload a smaller file."
      );
      return;
    }

    try {
      const response = await submitStudentAssignement(
        {
          std_rollno: formData.std_rollno,
          tb_id: formData.tb_id,
          as_id: formData.as_id,
          as_submission_comment: formData.as_submission_comment,
        },
        selectedFile || undefined
      );

      if (response.success) {
        const submissionCacheKey = `assignmentSubmissions_${formData.as_id}`;
        localStorage.removeItem(submissionCacheKey);

        setIsSubmitted(true);
        toast.success("Assignment submitted successfully.");

        setFormData({
          ...formData,
          as_submission_comment: "",
          submitted_on: response.submitted_on || "",
          obt_marks: response.obt_marks || "",
          as_submission_status: response.as_submission_status,
        });
        setSelectedFile(null);

        // Trigger UI update by re-fetching submission status
        await checkSubmissionAndDeadline();
      }
    } catch (error) {
      console.error("Error submitting assignment:", error);
      toast.error(
        "Submission Failed. Failed to submit assignment. Please try again."
      );
    }
  };

  const handleDownloadProof = async (proof: string) => {
    if (isDownloading) return;

    try {
      setIsDownloading(true);
      const fullUrl = `${BACKEND_URL}${proof}`;
      const response = await fetch(fullUrl);
      if (!response.ok) {
        throw new Error("File not found");
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      const fileName = proof.split("/").pop() || "download";
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success("Download started.");
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Failed to download the file.");
    } finally {
      setTimeout(() => {
        setIsDownloading(false);
      }, 1000);
    }
  };

  const checkSubmissionAndDeadline = async () => {
    try {
      if (!assignment.as_deadline || isDeadlinePassed(assignment.as_deadline)) {
        setIsdeadlineExpired(true);
        toast.error(
          "Deadline Expired. The deadline for this assignment has passed."
        );
        return;
      }

      const response = await getStudentAssignmentSubmits(
        assignment.as_id,
        rollNumber
      );
      if (
        response.success &&
        response.assignmentSubmission &&
        response.assignmentSubmission.as_submission_status !== 2
      ) {
        setIsSubmitted(true);
        toast.success(
          "Already Submitted. You have already submitted this assignment."
        );
        console.log("Assignment Submission Response:", response);
        setFormData((prev) => ({
          ...prev,
          as_submission_comment:
            response.assignmentSubmission.as_submission_comment || "",
          submitted_on: response.assignmentSubmission.submitted_on || "",
          obt_marks: response.assignmentSubmission.obt_marks || "",
          as_submission_status:
            response.assignmentSubmission.as_submission_status,
        }));
      } else if (
        response.assignmentSubmission &&
        response.assignmentSubmission.as_submission_status === 2
      ) {
        setIsSubmitted(false);
        setFormData((prev) => ({
          ...prev,
          as_submission_comment: "",
          submitted_on: "",
          obt_marks: "",
          as_submission_status: 2,
        }));
      }
    } catch (error) {
      console.error("Error checking submission status:", error);
    }
  };

  useEffect(() => {
    if (assignment?.as_id && rollNumber && userType === "student") {
      checkSubmissionAndDeadline();
    }
  }, [assignment?.as_id, assignment?.as_deadline, rollNumber, isSubmitted]);

  useEffect(() => {
    if (userType === "student" && (!rollNumber || rollNumber === "undefined")) {
      const fetchStudentInfo = async () => {
        try {
          const response = await getStudendByUserId(user_id);
          if (response.success && response.data) {
            const studentData = response.data;
            const newStudentInfo = {
              rollNumber: studentData.std_rollno,
              name: studentData.std_name,
            };
            localStorage.setItem("studentInfo", JSON.stringify(newStudentInfo));
            // Update formData with the correct roll number
            setFormData(prev => ({ ...prev, std_rollno: studentData.std_rollno }));
          }
        } catch (error) {
          console.error("Failed to fetch student info:", error);
          toast.error("Could not retrieve student information. Please refresh.");
        }
      };
      fetchStudentInfo();
    }
  }, [userType, user_id, rollNumber]);
  // Add this useEffect to clear submission caches when component mounts and clean up when unmounting
  useEffect(() => {
    // Clear the submissions cache when the assignment view is shown (for trainers)
    if (userType !== "student" && assignment?.as_id) {
      const submissionCacheKey = `assignmentSubmissions_${assignment.as_id}`;
      localStorage.removeItem(submissionCacheKey);
    }

    // Clean-up function to handle component unmounting
    return () => {
      // No cleanup needed for cache, but can be added if needed
    };
  }, []);

  // Helper function to get student's points display text
  const getStudentPointsDisplay = () => {
    if (assignment.studentStats) {
      if (assignment.studentStats.status === 1) {
        return `${assignment.studentStats.obtainedMarks} / ${assignment.as_marks}`;
      }
      return assignment.studentStats.hasSubmitted
        ? "NOT MARKED YET"
        : "NOT SUBMITTED";
    }
    return "NOT SUBMITTED";
  };

  // Format statistics for trainer view
  const getTrainerStatistics = () => {
    if (assignment.statistics) {
      return {
        submissions: String(assignment.statistics.submissionCount || "0"),
        pendingSubmissions: String(assignment.statistics.pendingCount || "0"),
        totalStudents: String(assignment.statistics.totalStudents || "0"),
        obtainedPoints: assignment.statistics.avgMarks
          ? `${assignment.statistics.avgMarks} (avg)`
          : "0",
      };
    }

    return {
      submissions: "0",
      pendingSubmissions: "0",
      totalStudents: "0",
      obtainedPoints: "0",
    };
  };

  const trainerStats = getTrainerStatistics();

  return (
    <div className="min-h-screen container bg-[hsl(var(--background))] p-4 md:p-8">
      {/* Back Button */}
      <button
        className="mb-4 flex items-center text-sm text-blue-600 hover:underline"
        onClick={() => {
          if (setActiveTab) {
            localStorage.removeItem("assignmentDetails");
            setActiveTab("AssignmentList");
          } else {
            window.history.back();
          }
        }}
      >
        ← Back to Assignments List
      </button>
      <SettingsHeader
        SettingsHeader="Post Assignment"
        SettingDescription="Giving assignments to students can promote their self-learning, time management, boosts their memory retention & also allows them to revise content."
      />

      <div className="mx-auto py-6 md:py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {/* Main Content Column */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300">
              {/* Assignment Details Section */}
              <div className="p-6 md:p-8">
                <h2 className="text-xl md:text-2xl font-bold text-[hsl(var(--foreground))] mb-4">
                  {assignment.as_title}
                </h2>
                <CustomCKEditor
                  value={assignment.as_description}
                  isViewOnly={true} // Always view-only in AssignmentView
                />
                {assignment.as_attachment && (
                  <Button
                    variant="secondary"
                    className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)] text-[hsl(var(--primary-foreground))] transition-colors duration-200"
                    onClick={() =>
                      handleDownloadProof(assignment.as_attachment)
                    }
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      "Download Attachment"
                    )}
                  </Button>
                )}
              </div>

              {/* Student Submission Section */}
              {userType === "student" && (
                <div className="border-t border-[hsl(var(--border))] p-6 md:p-8">
                  <h3 className="text-lg md:text-xl font-semibold text-[hsl(var(--foreground))] mb-6">
                    Submit your Assignment
                  </h3>
                  {isdeadlineExpired ? (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-red-600">
                        The deadline for this assignment has expired on{" "}
                        {assignment.as_deadline
                          ? formatDeadlineDate(assignment.as_deadline)
                          : "N/A"}
                        . Submissions are no longer accepted.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <Textarea
                        value={formData.as_submission_comment}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            as_submission_comment: e.target.value,
                          })
                        }
                        required
                        disabled={isSubmitted || isdeadlineExpired}
                        placeholder="Write something about your assignment submission..."
                        className={`min-h-[150px] w-full border border-[hsl(var(--border))] rounded-lg 
                          focus:ring-2 focus:ring-[hsl(var(--primary)/0.5)] focus:border-[hsl(var(--primary))]
                          ${
                            isSubmitted || isdeadlineExpired
                              ? "bg-[hsl(var(--muted))] cursor-not-allowed"
                              : ""
                          }`}
                      />

                      <input
                        type="file"
                        onChange={handleFileChange}
                        accept=".jpg,.png,.webp,.docx,.xlsx,.pdf,.zip"
                        disabled={isSubmitted || isdeadlineExpired}
                        className={`block w-full text-sm text-[hsl(var(--muted-foreground))]
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-full file:border-0
                          file:text-sm file:font-semibold
                          file:bg-[hsl(var(--primary))] file:text-[hsl(var(--primary-foreground))]
                          hover:file:bg-[hsl(var(--primary)/0.9)]
                          transition-colors duration-200
                          ${
                            isSubmitted || isdeadlineExpired
                              ? "opacity-50 cursor-not-allowed"
                              : ""
                          }`}
                      />
                      <p className="text-sm text-gray-500 mt-2">
                        Please upload a file up to <strong>5 MB</strong> in one
                        of the following formats:{" "}
                        <strong>
                          .jpg, .png, .webp, .docx, .xlsx, .pdf, .zip
                        </strong>
                        .{" "}
                        <span className="text-red-500">
                          Files in other formats are not allowed.
                        </span>
                      </p>

                      <Button
                        type="submit"
                        disabled={isSubmitted || isdeadlineExpired}
                        className={`w-full ${
                          isSubmitted || isdeadlineExpired
                            ? "bg-gray-400 cursor-not-allowed opacity-50"
                            : "bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)]"
                        } text-[hsl(var(--primary-foreground))] transition-colors duration-200`}
                      >
                        {isSubmitted
                          ? "Assignment Submitted"
                          : isdeadlineExpired
                          ? "Deadline Expired"
                          : "Submit Assignment"}
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Column */}
          <div className="space-y-6">
            {userType === "student" ? (
              <>
                <DeadlineTimer
                  deadline={assignment.as_deadline}
                  setIsdeadlineExpired={setIsdeadlineExpired}
                />
                <StatisticsPanel
                  student={name}
                  rollNo={rollNumber}
                  submittedOn={
                    assignment.studentStats.submissionDate === undefined ||
                    assignment.studentStats.submissionDate === null
                      ? "NOT SUBMITTED"
                      : assignment.studentStats.submissionDate
                  }
                  deadline={assignment.as_deadline_formatted}
                  totalPoints={assignment.as_marks}
                  obtainedPoints={getStudentPointsDisplay()}
                />
              </>
            ) : (
              <TrainerStatisticsPanel
                points={assignment.as_marks}
                submissions={String(submittedCount) || "0"}
                deadline={assignment.as_deadline_formatted}
                pendingSubmissions={String(notSubmittedCount) || "0"}
                obtainedPoints={trainerStats.obtainedPoints}
                totalStudents={String(totalStudents) || "0"}
              />
            )}
          </div>
        </div>
        {userType !== "student" && (
          <AssignmentSubmissionList
            as_id={assignment.as_id}
            setActiveTab={setActiveTab}
          />
        )}
      </div>
    </div>
  );
};

export default AssignmentView;
