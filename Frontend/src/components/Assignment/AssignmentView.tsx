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

  /**
   * The student's own submission, once fetched.
   *
   * Held separately from the form: the form is what they are about to send,
   * this is what they already sent. Conflating the two is why a submitted
   * assignment showed nothing back - there was nowhere to put it.
   */
  const [submission, setSubmission] = useState<any | null>(null);
  const studentInfo = JSON.parse(localStorage.getItem("studentInfo") || "{}");
  const rollNumber = studentInfo.rollNumber || "";
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
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File too large. Please select a file smaller than 5MB.");
        event.target.value = "";
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
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to submit assignment. Please try again.";
      toast.error(`Submission Failed. ${errorMessage}`);
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
      // The deadline and the submission are two independent questions, and
      // tangling them is what hid every student's work.
      //
      // This used to `return` as soon as the deadline had passed - BEFORE
      // fetching the submission - so an assignment whose deadline was in the
      // past showed "NOT SUBMITTED" to everyone, whether they had handed in or
      // not. The deadline is exactly when a student most wants to look: it is
      // when the marks appear.
      const response = await getStudentAssignmentSubmits(
        assignment.as_id,
        formData.std_rollno
      );

      const found = response?.assignmentSubmission;

      // Status 2 means the trainer returned it for rework, so there is work to
      // look at but the student may submit again.
      const returnedForRework = found && Number(found.as_submission_status) === 2;

      setSubmission(found || null);
      setIsSubmitted(Boolean(found) && !returnedForRework);

      if (found) {
        setFormData((prev) => ({
          ...prev,
          as_submission_comment: returnedForRework
            ? ""
            : found.as_submission_comment || "",
          submitted_on: found.submitted_on || "",
          obt_marks: found.obt_marks || "",
          as_submission_status: found.as_submission_status,
        }));
      }
    } catch (error: any) {
      // 404 is the ordinary "nothing handed in yet" answer, not a fault.
      if (error?.response?.status === 404) {
        setSubmission(null);
        setIsSubmitted(false);
        return;
      }
      console.error("Error checking submission status:", error);
    }
  };

  /**
   * Whether the deadline has passed. Its own effect now, because it used to be
   * set inside the submission fetch - which meant it depended on that fetch
   * running, and that fetch returning early depended on it.
   */
  useEffect(() => {
    setIsdeadlineExpired(
      !assignment?.as_deadline || isDeadlinePassed(assignment.as_deadline)
    );
  }, [assignment?.as_deadline]);

  useEffect(() => {
    if (assignment?.as_id && formData.std_rollno && userType === "student") {
      checkSubmissionAndDeadline();
    }
    // `isSubmitted` is deliberately NOT a dependency. The function sets it, so
    // listing it made the effect re-run every time it succeeded - refetching in
    // a loop and firing a toast on each pass.
  }, [assignment?.as_id, formData.std_rollno, userType]);

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
    // The fetched submission is the truth here. studentStats is a snapshot
    // taken when the list loaded, so relying on it alone reported "NOT
    // SUBMITTED" to a student looking at work they had just handed in.
    const status = submission
      ? Number(submission.as_submission_status)
      : assignment.studentStats?.status;
    const marks = submission
      ? submission.obt_marks
      : assignment.studentStats?.obtainedMarks;
    const handedIn = Boolean(submission) || assignment.studentStats?.hasSubmitted;

    if (status === 1 && marks !== null && marks !== undefined && marks !== "") {
      return `${marks} / ${assignment.as_marks}`;
    }
    if (status === 2) return "RETURNED FOR REWORK";
    return handedIn ? "NOT MARKED YET" : "NOT SUBMITTED";
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
                  {/* What they handed in. Shown whether or not the deadline has
                      passed - after it passes is exactly when a student looks,
                      because that is when the marks appear. */}
                  {submission && (
                    <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="font-semibold text-emerald-900">
                          Your submission
                        </h4>
                        <span className="rounded-full bg-emerald-600 px-3 py-0.5 text-xs font-semibold text-white">
                          {Number(submission.as_submission_status) === 1
                            ? "Marked"
                            : Number(submission.as_submission_status) === 2
                            ? "Returned for rework"
                            : "Submitted - awaiting marking"}
                        </span>
                      </div>

                      <dl className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between gap-4">
                          <dt className="text-emerald-800">Submitted on</dt>
                          <dd className="font-medium text-emerald-950">
                            {submission.submitted_on || "—"}
                          </dd>
                        </div>

                        <div className="flex justify-between gap-4">
                          <dt className="text-emerald-800">Marks</dt>
                          <dd className="font-medium text-emerald-950">
                            {Number(submission.as_submission_status) === 1 &&
                            submission.obt_marks !== null &&
                            submission.obt_marks !== ""
                              ? `${submission.obt_marks} / ${assignment.as_marks}`
                              : "Not marked yet"}
                          </dd>
                        </div>

                        {submission.as_submission_comment && (
                          <div>
                            <dt className="text-emerald-800">Your comment</dt>
                            <dd className="mt-1 whitespace-pre-wrap rounded border border-emerald-200 bg-white p-2 text-emerald-950">
                              {submission.as_submission_comment}
                            </dd>
                          </div>
                        )}

                        {submission.trainer_comments && (
                          <div>
                            <dt className="text-emerald-800">
                              Feedback from your trainer
                            </dt>
                            <dd className="mt-1 whitespace-pre-wrap rounded border border-emerald-200 bg-white p-2 text-emerald-950">
                              {submission.trainer_comments}
                            </dd>
                          </div>
                        )}
                      </dl>

                      {/* The file they uploaded. There was no way to see it at
                          all before - a student could not check that the right
                          thing had gone in. */}
                      {submission.as_submission_attachment && (
                        <a
                          href={`${BACKEND_URL}${submission.as_submission_attachment}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-2 rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
                        >
                          Open the file you submitted
                        </a>
                      )}
                    </div>
                  )}

                  {isdeadlineExpired ? (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-red-600">
                        The deadline for this assignment has expired on{" "}
                        {assignment.as_deadline
                          ? formatDeadlineDate(assignment.as_deadline)
                          : "N/A"}
                        .{" "}
                        {submission
                          ? "Your submission above was received."
                          : "Submissions are no longer accepted."}
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
                  // The freshly fetched submission first, falling back to what
                  // the list said. studentStats is a snapshot from whenever the
                  // list was loaded, so on its own it showed "NOT SUBMITTED"
                  // to a student who had just handed in.
                  submittedOn={
                    submission?.submitted_on ||
                    assignment.studentStats?.submissionDate ||
                    "NOT SUBMITTED"
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
