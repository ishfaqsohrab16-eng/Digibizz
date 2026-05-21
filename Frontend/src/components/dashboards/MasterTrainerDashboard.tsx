import React, { useEffect, useState } from "react";
import {
  DollarSign,
  Users,
  FileText,
  ClipboardList,
  AlertCircle,
} from "lucide-react";
import { getMasterTrainerDashoard, loginAsSubUser } from "../../services/api";
import Loader from "../Loader";
import StatCard from "./StudentDashboardItems/StatCard";
import { useBatch } from "../../context/BatchContext";
import { createSubUserSessionUrl } from "../../utils/navigationUtils";
interface AdminDashboardProps {
    openForm: (formName: string) => void;
  }
export interface MasterTrainerDashboardData {
  statistics: {
    totalCenters: number;
    totalTrainers: number;
    totalStudents: number;
    totalTickets: number;
    totalAssignments: number;
    totalQuizzes: number;
    totalEarnings: string;
    trainerCenterData: Array<{
      trainer_user_id: number;
      trainerName: string;
      centerName: string;
      earnings: string;
      totalDays: number;
      submittedDays: number;
      reportPercentage: number;
    }>;
  };
}

const MasterTrainerDashboard: React.FC<AdminDashboardProps> = ({ openForm }) => {
  const [dashboardData, setDashboardData] =
    useState<MasterTrainerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rowLoading, setRowLoading] = useState<number | null>(null); // Track loading state for each row
  const { user_id, selectedBatchId, userType} = useBatch();

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await getMasterTrainerDashoard(
        user_id,
        selectedBatchId,
        userType
      );
      console.log("Fetched Dashboard Data:", response); // Debugging log
      setDashboardData(response); // Ensure state is updated
    } catch (err) {
      setError("Failed to fetch dashboard data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const loginAsTrainer = async (user_id: number) => {
    // Open a blank window synchronously to avoid popup blockers in Safari
    const win = window.open("about:blank", "_blank");
    try {
      setRowLoading(user_id); // Set loading state for the clicked row
      const login = await loginAsSubUser(user_id, selectedBatchId);

      if (login.success) {
        const loginUrl = createSubUserSessionUrl(user_id);
        if (win) {
          win.location.href = loginUrl;
        }
      } else {
        if (win) {
          win.close();
        }
        console.error("Login failed");
      }
    } catch (error) {
      if (win) {
        win.close();
      }
      console.error("Error during login:", error);
    } finally {
      setRowLoading(null); // Reset loading state
    }
  };
  useEffect(() => {
    if(selectedBatchId){
      fetchDashboardData();
    }
  }, [selectedBatchId]); // Ensure dependency triggers re-fetch

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">
            Error Loading Dashboard
          </h3>
          <p className="text-[hsl(var(--foreground))]">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard
            icon={<Users className="h-5 w-5" />}
            iconBgColor="bg-teal"
            title="Total Centers"
            titleColor="text-teal"
            value={dashboardData?.statistics?.totalCenters.toString() || "0"}
            valueColor="text-teal"
            description="Centers under management"
            bgColor="bg-teal-light"
          />
          <StatCard
            icon={<Users className="h-5 w-5" />}
            iconBgColor="bg-pink"
            title="Total Trainers"
            titleColor="text-pink"
            value={dashboardData?.statistics?.totalTrainers.toString() || "0"}
            valueColor="text-pink"
            description="Trainers in all centers"
            bgColor="bg-pink-light"
          />
          <StatCard
            icon={<Users className="h-5 w-5" />}
            iconBgColor="bg-navy"
            title="Total Students"
            titleColor="text-navy"
            value={dashboardData?.statistics?.totalStudents.toString() || "0"}
            valueColor="text-navy"
            description="Students across all centers"
            bgColor="bg-navy-light"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard
            icon={<ClipboardList className="h-5 w-5" />}
            iconBgColor="bg-teal"
            title="Total Assignments"
            titleColor="text-teal"
            value={dashboardData?.statistics?.totalAssignments.toString() || "0"}
            valueColor="text-teal"
            description="Assignments created"
            bgColor="bg-teal-light"
          />
          <StatCard
            icon={<FileText className="h-5 w-5" />}
            iconBgColor="bg-pink"
            title="Total Quizzes"
            titleColor="text-pink"
            value={dashboardData?.statistics?.totalQuizzes.toString() || "0"}
            valueColor="text-pink"
            description="Quizzes conducted"
            bgColor="bg-pink-light"
          />
          <StatCard
            icon={<DollarSign className="h-5 w-5" />}
            iconBgColor="bg-navy"
            title="Total Earnings"
            titleColor="text-navy"
            value={`$${dashboardData?.statistics?.totalEarnings || "0.00"}`}
            valueColor="text-navy"
            description="Earnings across all centers"
            bgColor="bg-navy-light"
          />
        </div>

        <div className="mt-6">
          <h2 className="text-lg font-medium text-[hsl(var(--foreground))] mb-4">
            Trainer Center Data
          </h2>
          <div className="border rounded-md p-4 bg-background shadow">
            <table className="min-w-full table-auto border-collapse border bg-background border-gray-200">
              <thead>
                <tr className="bg-background">
                  <th className="border border-gray-200 px-4 py-2 text-left text-[hsl(var(--foreground))] font-medium">
                    Trainer Name
                  </th>
                  <th className="border border-gray-200 px-4 py-2 text-left text-[hsl(var(--foreground))] font-medium">
                    Center Name
                  </th>
                  <th className="border border-gray-200 px-4 py-2 text-left text-[hsl(var(--foreground))] font-medium">
                    Earnings
                  </th>
                   <th className="border border-gray-200 px-4 py-2 text-left text-[hsl(var(--foreground))] font-medium">
                    Daily Lecture Report
                  </th>
                </tr>
              </thead>
              <tbody>
                {dashboardData?.statistics?.trainerCenterData.map((data, index) => (
                  <tr
                    key={index}
                    className={index % 2 === 0 ? "bg-background" : "bg-background"}
                  >
                    <td
                      onClick={() => !rowLoading && loginAsTrainer(data.trainer_user_id)} // Prevent multiple clicks
                      className={`border border-gray-200 px-4 py-2 text-[hsl(var(--foreground))] ${
                        rowLoading === data.trainer_user_id ? "cursor-wait" : "cursor-pointer"
                      } group relative`}
                    >
                      <span className="flex items-center">
                        {rowLoading === data.trainer_user_id ? "Logging in..." : data.trainerName}
                        <span
                          className="ml-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200 ease-in-out"
                        >
                          ➡️
                        </span>
                      </span>
                    </td>
                    <td className="border border-gray-200 px-4 py-2 text-[hsl(var(--foreground))]">
                      {data.centerName}
                    </td>
                    <td className="border border-gray-200 px-4 py-2 text-teal font-semibold">
                      ${data.earnings}
                    </td>
                    <td className="border border-gray-200 px-4 py-2 text-[hsl(var(--foreground))]">
                      {data.reportPercentage.toFixed(2)}%
                      <div className="mt-1 text-xs text-gray-500">
                        {data.submittedDays} of {data.totalDays} days submitted
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div
                          className="relative w-32 h-3 rounded overflow-hidden"
                          style={{
                            background: "hsl(var(--muted))",
                            border: "1px solid hsl(var(--border))",
                          }}
                        >
                          <div
                            className="absolute left-0 top-0 h-full transition-all duration-700"
                            style={{
                              background:
                                "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))",
                              width: `${data.reportPercentage}%`,
                              minWidth: data.reportPercentage > 0 ? "0.5rem" : "0",
                            }}
                          ></div>
                        </div>
                        <span>
                          {data.reportPercentage >= 90
                            ? "😃" // very good
                            : data.reportPercentage >= 70
                            ? "🙂" // good
                            : data.reportPercentage >= 40
                            ? "😐" // okay
                            : data.reportPercentage > 0
                            ? "😕" // poor
                            : "😶"}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MasterTrainerDashboard;