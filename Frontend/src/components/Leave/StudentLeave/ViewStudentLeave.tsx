import { useBatch } from "../../../context/BatchContext";
import { updateStudentLeave } from "../../../services/api";
import React, { useState } from "react";
import { toast } from "sonner";
interface UpdateDataProps {
  status: number;
  comment: string;
}

const ViewStudentLeave = ({
  viewStudentLeave,
}: {
  viewStudentLeave: any[];
}) => {
  const leaveData = viewStudentLeave[0];
  const [status, setStatus] = useState(leaveData.sl_status);
  const [comments, setComments] = useState(leaveData.sl_trainer_comments || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const { userType } = useBatch();
  const [updateData, setUpdateData] = useState<UpdateDataProps>({
    status: leaveData.sl_status,
    comment: leaveData.sl_trainer_comments || "",
  });

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = parseInt(e.target.value);
    setStatus(value);
    setUpdateData({ ...updateData, status: value });
  };

  const handleCommentsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setComments(value);
    setUpdateData({ ...updateData, comment: value });
  };

  const handleUpdate = async () => {
    try {
      setIsUpdating(true);
      const response = await updateStudentLeave(
        leaveData.sl_code,
        updateData.status,
        updateData.comment
      );
      if (response.success) {
        toast.success(response.message, {
          className: "toast-success",
        });

        // Update the UI with the updated fields from the API response
        const updatedFields = response.updatedFields;
        if(updatedFields.sl_status === 1) {
          updatedFields.sl_status = "Approved";
        } else if(updatedFields.sl_status === 2) {
          updatedFields.sl_status = "Rejected";
        } 
        leaveData.sl_status = updatedFields.sl_status
        leaveData.sl_trainer_comments = updatedFields.sl_trainer_comments;
        leaveData.center_name = updatedFields.center_name || leaveData.center_name;
        leaveData.course_name = updatedFields.course_name || leaveData.course_name;
        leaveData.tb_name = updatedFields.tb_name || leaveData.tb_name;

        setStatus(updatedFields.sl_status);
        setComments(updatedFields.sl_trainer_comments);
        setUpdateData({
          status: updatedFields.sl_status,
          comment: updatedFields.sl_trainer_comments,
        });
      }
    } catch (error) {
      console.error("Update failed:", error);
      toast.error("Failed to update leave status and comments.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (!viewStudentLeave || viewStudentLeave.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg shadow-md">
        <p className="text-center text-gray-600 italic">
          No leave application data available.
        </p>
      </div>
    );
  }

  const leaveStatusColor =
    leaveData.sl_status === "Approved"
      ? "bg-[hsl(var(--teal))] text-[hsl(var(--primary-foreground))]"
      : leaveData.sl_status === "Rejected"
      ? "bg-[hsl(var(--pink))] text-[hsl(var(--destructive-foreground))]"
      : "bg-[hsl(var(--navy))] text-[hsl(var(--accent-foreground))]";

  return (
    <div className="bg-[hsl(var(--card))] rounded-2xl mt-5 shadow-[hsl(var(--border))] overflow-hidden">
      {/* Header Section */}
      <div className="bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] py-4 px-4 sm:py-6 sm:px-6 lg:py-8">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight break-words">
          Leave Application Code: {leaveData.sl_code}
        </h2>

        <p className="text-sm sm:text-base lg:text-lg mt-2 opacity-80">
          Review the details of your leave request.
        </p>
      </div>

      {/* Main Content */}
      <div className="p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 bg-[hsl(var(--background))]">
        {/* Left Column */}
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="mb-4 sm:mb-6">
            <label className="block text-sm font-medium text-[hsl(var(--foreground))]">
              TO,
            </label>
            <div className="mt-1 text-[hsl(var(--foreground))]">
              <div className="font-medium">The Trainer,</div>
              <div className="break-words">
                {leaveData.course_name || "AWE - ITTI"} -{" "}
                {leaveData.center_name || "N/A"}
              </div>
              <div className="break-words">DigiBizz Program {leaveData.tb_name || "Batch-6"}</div>
            </div>
          </div>

          <div className="mb-4 sm:mb-6">
            <label className="block text-sm font-medium text-[hsl(var(--foreground))]">
              Subject:
            </label>
            <p className="mt-1 text-base sm:text-lg font-semibold text-[hsl(var(--foreground))] break-words">
              {leaveData.sl_subject || "Family emergency"}
            </p>
          </div>

          <div className="mb-4 sm:mb-6">
            <label className="block text-sm font-medium text-[hsl(var(--foreground))]">
              Body
            </label>
            <p
              className="p-3 sm:p-4 rounded-lg mt-1 text-[hsl(var(--foreground))] leading-relaxed
             max-w-full break-words overflow-hidden text-sm sm:text-base"
              dangerouslySetInnerHTML={{ __html: leaveData.sl_body }}
            ></p>
          </div>
        </div>

        {/* Right Column */}
        <div className="p-4 sm:p-0">
          <div className="mb-4 sm:mb-6">
            <label className="block text-sm font-medium text-[hsl(var(--foreground))]">
              Leave Status
            </label>
            <div className="mt-1">
              <span
                className={`inline-flex items-center px-2 sm:px-3 py-1 sm:py-2 rounded-full text-xs sm:text-sm font-medium ${leaveStatusColor}`}
              >
                {leaveData.sl_status || "N/A"}
              </span>
            </div>
          </div>

          <div className="mb-4 sm:mb-6">
            <label className="block text-sm font-medium text-[hsl(var(--foreground))]">
              Recipient
            </label>
            <div className="mt-1">
              <div className="text-[hsl(var(--foreground))] text-sm sm:text-base">
                <div className="font-medium text-[hsl(var(--foreground))]">The Trainer,</div>
                <div className="break-words">
                  {leaveData.course_name || "N/A"} -{" "}
                  {leaveData.center_name || "N/A"}
                </div>
                <div className="font-medium text-[hsl(var(--foreground))] break-words">DigiBizz Program {leaveData.tb_name || "N/A"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[hsl(var(--muted))] px-4 sm:px-6 lg:px-8 py-4 sm:py-6 border-t border-[hsl(var(--border))] grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div>
          <label className="block text-sm font-medium text-[hsl(var(--foreground))]">
            Sender Information
          </label>
          <div className="mt-2">
            <div className="font-medium text-[hsl(var(--foreground))] text-sm sm:text-base break-words">
              {leaveData.std_name || "N/A"}
            </div>
            <div className="text-[hsl(var(--foreground))] text-sm sm:text-base break-all">{leaveData.std_cnic || "N/A"}</div>
            <div className="text-[hsl(var(--foreground))] text-sm sm:text-base">
              {leaveData.sl_submit_date || "N/A"}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[hsl(var(--foreground))]">
            Trainer's Comment
          </label>
          <p className="mt-2 text-[hsl(var(--foreground))] text-sm sm:text-base break-words">
            {leaveData.sl_trainer_comments || "N/A"}
          </p>
        </div>
      </div>
      {leaveData.sl_status === "Pending" && userType === "trainer" && (
        <div className="m-4 sm:m-6 lg:m-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <div className="mb-4 sm:mb-6">
              <label
                htmlFor="status"
                className="block text-[hsl(var(--foreground))] text-base sm:text-lg font-semibold mb-2"
              >
                Status:
              </label>
              <select
                id="status"
                value={status}
                onChange={handleStatusChange}
                className="shadow appearance-none border rounded w-full py-2 sm:py-3 px-3 sm:px-4 text-[hsl(var(--foreground))] leading-tight focus:outline-none focus:shadow-outline text-sm sm:text-base"
              >
                <option>please Select</option>
                <option value={1}>Approved</option>
                <option value={2}>Rejected</option>
              </select>
            </div>
            <div className="mb-6 sm:mb-8">
              <label
                htmlFor="comments"
                className="block text-[hsl(var(--foreground))] text-base sm:text-lg font-semibold mb-2"
              >
                Trainer Comments:
              </label>
              <textarea
                id="comments"
                value={comments}
                onChange={handleCommentsChange}
                rows={4}
                className="shadow appearance-none border rounded w-full py-2 sm:py-3 px-3 sm:px-4 text-[hsl(var(--foreground))] leading-tight focus:outline-none focus:shadow-outline text-sm sm:text-base resize-y min-h-[100px]"
              />
            </div>
          </div>
          <div className="flex justify-start">
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)] text-[hsl(var(--primary-foreground))] font-bold py-2 sm:py-3 px-4 sm:px-6 rounded-full text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
            >
              {isUpdating ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewStudentLeave;
