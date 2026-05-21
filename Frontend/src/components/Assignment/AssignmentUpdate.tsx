import { useState, useEffect } from "react";
import { updateAssignmentSubmission } from "../../services/api";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Input } from "../ui/input";
import SettingsHeader from "../Settings/SettingsHeader";
import { Loader2 } from "lucide-react";

interface AssignmentUpdateProps {
  assignment?: any;
  setActiveTab?: (tab: string) => void;
}

const AssignmentUpdate: React.FC<AssignmentUpdateProps> = ({
  assignment,
  setActiveTab,
}) => {
  // If assignment is not provided, try to get it from localStorage
  const [submission, setSubmission] = useState<any>(assignment);
  const [marks, setMarks] = useState("");
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => {
    setIsMounted(true);
    try {
      const savedSubmission = localStorage.getItem("selectedSubmission");
      if (savedSubmission) {
        const parsedSubmission = JSON.parse(savedSubmission);
        setSubmission(parsedSubmission);
        setMarks(parsedSubmission.obtained_marks || "");
        setComments(parsedSubmission.trainer_comments || ""); // <-- use trainer_comments, not submission_comment
      }
    } catch (error) {
      console.error("Error parsing saved submission:", error);
    }

    // Clean up function to prevent state updates after unmount
    return () => {
      setIsMounted(false);
    };
  }, [assignment]);

  const handleUpdate = async (status: number) => {
    if (!submission || !isMounted) {
      if (isMounted) toast.error("No submission data available");
      return;
    }

    try {
      setIsSubmitting(true);
      await updateAssignmentSubmission(submission.submission_id, {
        obt_marks: marks,
        trainer_comments: comments,
        as_submission_status: status,
      });

      // Simplified cache key based only on assignment ID
      const submissionCacheKey = `assignmentSubmissions_${submission.as_id}`;
      localStorage.removeItem(submissionCacheKey);

      // Only update UI if component is still mounted
      if (isMounted) {
        toast.success("Assignment updated successfully");

        // Clear the localStorage item
        localStorage.removeItem("selectedSubmission");

        // Navigate back if setActiveTab is provided
        if (setActiveTab) {
          setActiveTab("AssignmentView");
        }
      }
    } catch (error) {
      // Only show error if still mounted
      if (isMounted) {
        console.error("Error updating assignment:", error);
        toast.error("Failed to update assignment");
      }
    } finally {
      // Update state only if still mounted
      if (isMounted) {
        setIsSubmitting(false);
      }
    }
  };

  const handleCancel = () => {
    localStorage.removeItem("selectedSubmission");
    if (setActiveTab && isMounted) {
      setActiveTab("AssignmentView");
    }
  };

  const handleDownloadProof = async (proof: string) => {
    if (isDownloading) return; // Prevent multiple clicks

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

      // Show a success toast
      if (isMounted) {
        toast.success("Download started");
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      if (isMounted) {
        toast.error("Error downloading the file");
      }
    } finally {
      // Small delay to prevent immediate re-clicks
      setTimeout(() => {
        if (isMounted) {
          setIsDownloading(false);
        }
      }, 1000);
    }
  };

  if (!submission) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500">No submission data available</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Back Button */}
      {setActiveTab && (
        <button
          className="mb-4 flex items-center text-sm text-blue-600 hover:underline"
          onClick={() => setActiveTab("AssignmentView")}
        >
          ← Back to Assignment View
        </button>
      )}
      <SettingsHeader
        SettingsHeader="Update Assignment Submission"
        SettingDescription="Review and grade the student's assignment submission"
      />

      <div className="bg-white rounded-lg shadow-md p-6 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-lg font-medium mb-2">Student Information</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">Name:</span>
                <span>{submission.std_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Roll Number:</span>
                <span>{submission.std_rollno}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Center:</span>
                <span>{submission.center_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Course:</span>
                <span>{submission.course_name}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-2">Assignment Information</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">Title:</span>
                <span>{submission.assignment_title}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Submission Date:</span>
                <span>{submission.submission_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Total Marks:</span>
                <span>{submission.total_marks}</span>
              </div>
              {submission.submission_attachment && (
                <div className="flex justify-between">
                  <span className="font-medium">Attachment:</span>
                  <Button
                    variant="link"
                    onClick={() =>
                      handleDownloadProof(submission.submission_attachment)
                    }
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Downloading...
                      </>
                    ) : (
                      "View Attachment"
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="text-lg font-medium mb-4">Student's Comment</h3>
          <div className="bg-gray-50 p-4 rounded-md">
            {submission.submission_comment || "No comments provided"}
          </div>
        </div>

        <div className="border-t pt-6 mt-6">
          <h3 className="text-lg font-medium mb-4">Evaluation</h3>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="font-medium">
                Marks <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                value={marks}
                onChange={(e) => setMarks(e.target.value)}
                placeholder="Enter marks"
                min="0"
                max={submission.total_marks}
                className="max-w-xs"
              />
              <p className="text-sm text-gray-500">
                Max marks: {submission.total_marks}
              </p>
            </div>

            <div className="space-y-2">
              <label className="font-medium">Feedback Comments</label>
              <Textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Add your feedback here"
                rows={5}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4 mt-6 border-t pt-6">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => handleUpdate(2)}
            disabled={isSubmitting}
          >
            Reject
          </Button>
          <Button onClick={() => handleUpdate(1)} disabled={isSubmitting}>
            Approve
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AssignmentUpdate;
