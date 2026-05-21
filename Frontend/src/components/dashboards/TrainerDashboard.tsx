import React, { useEffect, useState } from "react";
import {
  DollarSign,
  FileText,
  Clock,
  Database,
  AlertCircle,
  Loader2,
} from "lucide-react";
import axios from "axios";

import TrainerStatsTable from "./TrainerDashboardItems/TrainerStatsTable";
import TrainerAssignmentsCard from "./TrainerDashboardItems/TrainerAssignmentsCard";
import { useBatch } from "../../context/BatchContext";
import { getTrainersDashboardData } from "../../services/api";
import StatCard from "./StudentDashboardItems/StatCard";
import DiscussionItem from "./StudentDashboardItems/DiscussionItem";
import WhatsNewCard from "./StudentDashboardItems/WhatsNewCard";
import TicketsTable from "./StudentDashboardItems/TicketsTable";
import Loader from "../Loader";
interface AdminDashboardProps {
  openForm: (formName: string) => void;
}
export interface TrainerDashboardData {
  statistics: {
    pendingLeaves?: {
      count: number;
      lastUpdated: string;
    };
    missingAttendance?: {
      count: number;
      dates: string[];
      lastUpdated: string;
    };
    recentAssignments?: Array<{
      as_title: string;
      as_deadline: string;
    }>;
    students?: {
      active: number;
      total: number;
    };
    batchEarnings?: string;
    successStories?: {
      count: number;
      lastUpdated: string;
    };
    isDailyReportSubmitted?: boolean;
    isAttendance?: boolean;
  };
}

const CACHE_KEY = "trainerDashboardData";
const CACHE_DURATION = 24 * 60 * 60 * 1000;

const TrainerDashboard: React.FC<AdminDashboardProps> = ({ openForm }) => {
  const [dashboardData, setDashboardData] =
    useState<TrainerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user_id, selectedBatchId, userType } = useBatch();
  const [missingAttendance, setMissingAttendance] = useState<string[]>([]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // const batchCacheKey = `${CACHE_KEY}_${user_id}_${selectedBatchId}`;
      // const cachedData = localStorage.getItem(batchCacheKey);
      // if (cachedData) {
      //   const { data, timestamp } = JSON.parse(cachedData);
      //   const isStillValid = Date.now() - timestamp < CACHE_DURATION;

      //   if (isStillValid) {
      //     setDashboardData(data);
      //     setLoading(false);
      //     return;
      //   }
      // }

      const response = await getTrainersDashboardData(
        user_id,
        selectedBatchId,
        userType
      );
      if (response) {
        // Check if missingAttendance is present in the response
        if (response.statistics?.missingAttendance?.dates) {
          const nonWeekendDates =
            response.statistics.missingAttendance.dates.filter(
              (date: string) => {
                const dayOfWeek = new Date(date).getDay();
                return dayOfWeek !== 0 && dayOfWeek !== 6;
              }
            );
          setMissingAttendance(nonWeekendDates);
        } else {
          setMissingAttendance([]);
        }
      }
      // localStorage.setItem(
      //   batchCacheKey,
      //   JSON.stringify({
      //     data: response,
      //     timestamp: Date.now(),
      //   })
      // );

      setDashboardData(response);
    } catch (err) {
      setError("Failed to fetch dashboard data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user_id > 0 && selectedBatchId >= 0) {
      fetchDashboardData();
    }
  }, [user_id, selectedBatchId]);

  const handleRefresh = () => {
    const batchCacheKey = `${CACHE_KEY}_${user_id}_${selectedBatchId}`;
    localStorage.removeItem(batchCacheKey);
    if (user_id > 0 && selectedBatchId >= 0) {
      fetchDashboardData();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader />
          <p className="text-gray-500">
            Please wait while we fetch your data...
          </p>
        </div>
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
          <p className="text-gray-500">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <Database className="h-6 w-6 text-gray-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">
            No Data Available
          </h3>
          <p className="text-gray-500">
            We couldn't find any dashboard data. Please try again later or
            contact support if the issue persists.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Banner Messages */}
        {dashboardData?.statistics?.isDailyReportSubmitted === false &&
          new Date().getDay() !== 0 &&
          new Date().getDay() !== 6 && (
            <div className="mb-4 p-3 bg-yellow-100 text-teal rounded border-l-4 border-yellow-500">
              <p className="font-medium">⚠️ Daily Report Not Submitted</p>
              <p className="text-sm">
                Please submit your daily report to keep your dashboard updated.
                📋
              </p>
              <button
                onClick={() => openForm("DailyLectureReportForm")}
                className="text-blue-600 underline text-sm"
              >
                Submit Now ➡️
              </button>
            </div>
          )}
        {dashboardData?.statistics?.isAttendance === false &&
          new Date().getDay() !== 0 &&
          new Date().getDay() !== 6 && (
            <div className="mb-4 p-3 bg-yellow-100 text-teal rounded border-l-4 border-yellow-500">
              <p className="font-medium">⚠️ Attendance Not Marked</p>
              <p className="text-sm">
                Please mark your attendance to ensure accurate records. 🕒
              </p>
              <button
                onClick={() => openForm("TakeAttendance")}
                className="text-blue-600 underline text-sm"
              >
                Mark Now ➡️
              </button>
            </div>
          )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={<DollarSign className="h-5 w-5" />}
            iconBgColor="bg-teal"
            title="Batch Earnings"
            titleColor="text-teal"
            value={`$${dashboardData?.statistics?.batchEarnings || "0.00"}`}
            valueColor="text-teal"
            description="Total batch earnings"
            descriptionIcon={
              <DollarSign className="h-4 w-4 mr-1 text-gray-400" />
            }
            bgColor="bg-teal-light"
          />

          <StatCard
            icon={<FileText className="h-5 w-5" />}
            iconBgColor="bg-pink"
            title="Pending Leaves"
            titleColor="text-pink"
            value={
              dashboardData?.statistics?.pendingLeaves?.count?.toString() || "0"
            }
            valueColor="text-pink"
            description="Need approval"
            descriptionIcon={<Clock className="h-4 w-4 mr-1 text-gray-400" />}
            bgColor="bg-pink-light"
            onClick={() => openForm("StudentLeave")}
          />

          <StatCard
            icon={<Clock className="h-5 w-5" />}
            iconBgColor="bg-teal"
            title="Missing Attendance"
            titleColor="text-teal"
            value={
              dashboardData?.statistics?.missingAttendance?.count?.toString() ||
              "0"
            }
            valueColor="text-teal"
            description="Days pending"
            descriptionIcon={
              <AlertCircle className="h-4 w-4 mr-1 text-gray-400" />
            }
            bgColor="bg-teal-light"
            onClick={() => openForm("TakeAttendance")}
          />

          <StatCard
            icon={<Database className="h-5 w-5" />}
            iconBgColor="bg-navy"
            title="Active Students"
            titleColor="text-navy"
            value={`${dashboardData?.statistics?.students?.active || 0}/${
              dashboardData?.statistics?.students?.total || 0
            }`}
            valueColor="text-navy"
            description="Current batch"
            descriptionIcon={
              <Database className="h-4 w-4 mr-1 text-gray-400" />
            }
            bgColor="bg-navy-light"
            onClick={() => openForm("StudentTable")}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 lg:grid-rows-2 gap-4 mb-6">
          <div className="lg:col-span-2 lg:row-span-1">
            <div className="card-container animate-fade-up">
              <div className="flex items-center mb-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
                  />
                </svg>
                <h2 className="text-lg font-medium text-gray-700">
                  Recent Discussions
                </h2>
              </div>
              <div className="border rounded-md p-2">
                <DiscussionItem
                  text="Welcome to Batch-6 of the DigiBizz Program!"
                  color="bg-teal"
                />
                <DiscussionItem
                  text="How to Market Yourself as a Beginner Freelancer"
                  color="bg-teal"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 lg:row-span-2">
            <TrainerStatsTable
              students={
                dashboardData?.statistics?.students || {
                  active: 0,
                  total: 0,
                }
              }
              missingAttendance={
                dashboardData?.statistics?.missingAttendance || {
                  count: 0,
                  dates: [],
                  lastUpdated: "",
                }
              }
              pendingLeaves={
                dashboardData?.statistics?.pendingLeaves || {
                  count: 0,
                  lastUpdated: "",
                }
              }
              openForm={openForm}
            />
          </div>
          <div className="lg:col-span-2 lg:row-span-1">
            {/* <AnnouncementCard
              title="Important Announcement"
              message={[
                "Hello,",
                "I hope this message finds you well. Due to jiterma classes will be remain closed today.",
                "Regards",
              ]}
              author="MK"
              date="Mareena Khan / 21-02-2025"
            /> */}
          </div>
        </div>

        <div className="mb-6">
          <WhatsNewCard
            version="LMS Version: Beta 1.35"
            features={["Quiz Module added", "Design Improvements"]}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TicketsTable />
          <TrainerAssignmentsCard
            assignments={dashboardData?.statistics?.recentAssignments || []}
            openForm={openForm}
          />
        </div>
      </div>
    </div>
  );
};

export default TrainerDashboard;
