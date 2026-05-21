import { stat } from "fs";
import { useBatch } from "../../../context/BatchContext";
import {
  updateStudentLeave,
  updateTrainerLeave,
  updateTrainerLeaveByAdmin,
} from "../../../services/api";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
interface UpdateDataProps {
  status: number;
  MtComment: string;
  AdminComment: string;
}

const viewTrainerLeave = ({
  viewTrainerLeave,
}: {
  viewTrainerLeave: any[];
}) => {
  const [leaveData, setLeaveData] = useState(viewTrainerLeave[0]);
  const [status, setStatus] = useState(leaveData.tl_status);
  const [comments, setComments] = useState(leaveData.tl_trainer_comments || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const { userType } = useBatch();
  const [updateData, setUpdateData] = useState<UpdateDataProps>({
    status: leaveData.tl_status,
    MtComment: leaveData.tl_mt_comments || "",
    AdminComment: leaveData.tl_admin_comments || "",
  });

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = parseInt(e.target.value);
    setStatus(value);
    setUpdateData({ ...updateData, status: value });
  };

  const handleCommentsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setComments(value);
    if (userType === "MasterTrainer")
      setUpdateData({ ...updateData, MtComment: value });
    else setUpdateData({ ...updateData, AdminComment: value });
  };

  const handleUpdate = async () => {
    try {
      setIsUpdating(true);
      let response;
      if (userType === "MasterTrainer") {
        response = await updateTrainerLeave(
          leaveData.tl_code,
          updateData.status,
          updateData.MtComment
        );
      } else {
        response = await updateTrainerLeaveByAdmin(
          leaveData.tl_code,
          updateData.status,
          updateData.AdminComment
        );
      }

      if (response) {
        // Update local state with the updated fields from the response
        const { tl_status, tl_mt_comments, tl_admin_comments } = response.updatedFields;
        setStatus(tl_status);
        setComments(userType === "MasterTrainer" ? tl_mt_comments : tl_admin_comments);
        setUpdateData({
          ...updateData,
          status: tl_status,
          MtComment: tl_mt_comments || updateData.MtComment,
          AdminComment: tl_admin_comments || updateData.AdminComment,
        });

        // Update leaveData to trigger re-render
        setLeaveData((prev: typeof leaveData) => ({
          ...prev,
          tl_status: response.updatedFields.tl_status === 1 ? "MT Approved" : response.updatedFields.tl_status === 2 ? "MT Rejected" : response.updatedFields.tl_status === 3 ? "Admin Approved" : response.updatedFields.tl_status === 4 ? "Admin Rejected" : prev.tl_status,
          tl_mt_comments,
          tl_admin_comments,
        }));

        toast.success(response.message, {
          className: "toast-success",
        });
      }
    } catch (error) {
      console.error("Update failed:", error);
      toast.error("Failed to update leave status and comments.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (!viewTrainerLeave || viewTrainerLeave.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg shadow-md">
        <p className="text-center text-gray-600 italic">
          No leave application data available.
        </p>
      </div>
    );
  }

  const leaveStatusColor =
    leaveData.tl_status === "MT Approved"
      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
      : leaveData.tl_status === "MT Rejected"
      ? "bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]"
      : "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]";

  return (
    <div className="bg-[hsl(var(--card))] rounded-2xl mt-5 shadow-[hsl(var(--border))] overflow-hidden">
      {/* Header Section */}
      <div className="bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] py-8 px-6">
        <h2 className="text-3xl font-extrabold tracking-tight">
          Leave Application Code: {leaveData.tl_code}
        </h2>

        <p className="text-lg mt-2 opacity-80">
          Review the details of your leave request.
        </p>
      </div>

      {/* Main Content */}
      <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="p-8">
          <div className="mb-6">
            <label className="block text-sm font-medium text-[hsl(var(--foreground))]">
              TO,
            </label>
            <div className="mt-1 text-[hsl(var(--foreground))]">
              <div className="font-medium">The Master Trainer, Admin,</div>
              <div>
                {leaveData.course_name || "N/A"} -{" "}
                {leaveData.center_name || "N/A"}
              </div>
              <div>DigiBizz Program {leaveData.tb_name || "Batch-6"}</div>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-[hsl(var(--foreground))]">
              Subject:
            </label>
            <p className="mt-1 text-lg font-semibold text-[hsl(var(--foreground))]">
              {leaveData.tl_subject || "Family emergency"}
            </p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700">
              Body
            </label>
            <p
              className="p-4 rounded-lg mt-1 text-gray-700 leading-relaxed
             max-w-full break-words overflow-hidden"
              dangerouslySetInnerHTML={{ __html: leaveData.tl_body }}
            ></p>
          </div>
        </div>

        {/* Right Column */}
        <div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700">
              Leave Status
            </label>
            <div className="mt-1">
              <span
                className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-medium ${leaveStatusColor}`}
              >
                {leaveData.tl_status || "N/A"}
              </span>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700">
              Recipient
            </label>
            <div className="mt-1">
              <div className="text-gray-800">
                <div className="font-medium">{leaveData.t_name},</div>
                <div>
                  {leaveData.course_name || "N/A"} -{" "}
                  {leaveData.center_name || "N/A"}
                </div>
                <div>DigiBizz Program {leaveData.tb_name || "N/A"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[hsl(var(--muted))] px-8 py-6 border-t border-[hsl(var(--border))]">
        <div className="text-[hsl(var(--foreground))]">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Sender Information
            </label>
            <div className="mt-2">
              <div className="font-medium text-gray-800">
                {leaveData.t_name || "N/A"}
              </div>
              <div className="text-gray-600">{leaveData.tl_code || "N/A"}</div>
              <div className="text-gray-600">
                {leaveData.tl_submit_date || "N/A"}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Master Trainer's Comment
            </label>
            <p className="mt-2 text-gray-700">
              {leaveData.tl_mt_comments || "N/A"}
            </p>
            <label className="block text-sm font-medium text-gray-700">
              Admin's Comment
            </label>
            <p className="mt-2 text-gray-700">
              {leaveData.tl_admin_comments || "N/A"}
            </p>
          </div>
        </div>
      </div>
      {leaveData.tl_status === "Pending" && userType === "MasterTrainer" && (
        <div className="m-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="mb-6">
              <label
                htmlFor="status"
                className="block text-gray-700 text-lg font-semibold mb-2"
              >
                Status:
              </label>
              <select
                id="status"
                value={status}
                onChange={handleStatusChange}
                className="shadow appearance-none border rounded w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              >
                <option value={0}>please Select</option>
                <option value={1}>MT Approved</option>
                <option value={2}>MT Rejected</option>
              </select>
            </div>
            <div className="mb-8">
              <label
                htmlFor="comments"
                className="block text-gray-700 text-lg font-semibold mb-2"
              >
                Master Comments:
              </label>
              <textarea
                id="comments"
                value={comments}
                onChange={handleCommentsChange}
                className="shadow appearance-none border rounded w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>
          </div>
          <div className="flex justify-start">
            <button
              onClick={handleUpdate}
              className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)] text-[hsl(var(--primary-foreground))] font-bold py-3 px-6 rounded-full"
            >
              Save
            </button>
          </div>
        </div>
      )}
      {(status !== 0 || status !== "Pending") || (leaveData.tl_status === "MT Approved" ||
        leaveData.tl_status === "MT Rejected") ||
        (userType === "ContentAdmin" || userType === "SuperAdmin") && (
          <div className="m-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="mb-6">
                <label
                  htmlFor="status"
                  className="block text-gray-700 text-lg font-semibold mb-2"
                >
                  Status:
                </label>
                <select
                  id="status"
                  value={status}
                  onChange={handleStatusChange}
                  className="shadow appearance-none border rounded w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                >
                  <option value={0}>please Select</option>
                  <option value={3}>Admin Approved</option>
                  <option value={4}>Admin Rejected</option>
                </select>
              </div>
              <div className="mb-8">
                <label
                  htmlFor="comments"
                  className="block text-gray-700 text-lg font-semibold mb-2"
                >
                  Admin Comments:
                </label>
                <textarea
                  id="comments"
                  value={comments}
                  onChange={handleCommentsChange}
                  className="shadow appearance-none border rounded w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
              </div>
            </div>
            <div className="flex justify-start">
              <button
                onClick={handleUpdate}
                className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.9)] text-[hsl(var(--primary-foreground))] font-bold py-3 px-6 rounded-full"
              >
                Save
              </button>
            </div>
          </div>
        )}
    </div>
  );
};

export default viewTrainerLeave;
