import React, { useEffect, useState } from "react";
import ActivityTable from "./AdmindashboardItem/ActivityTable";
import FeatureCard from "./AdmindashboardItem/FeatureCard";
import SearchBar from "./AdmindashboardItem/SearchBar";
import StatCard from "./AdmindashboardItem/StatCard";
import {
  User,
  DollarSign,
  BookOpen,
  HelpCircle,
  FileEdit,
  CheckCircle,
  BarChart3,
  PieChart,
  Settings,
  Users,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getCenterUserDashoard } from "../../services/api";
import { useBatch } from "../../context/BatchContext";
import DataTable from "../AdmissionPortal/DataTable";
import { DEFAULT_ACTIVITY_LOG_COLUMNS } from "../../utils/tableUtils";
import { Column } from "../../types/columns";
import { set } from "date-fns";
import Loader from "../Loader";

export interface ActivityLog {
  act_id: number;
  user_type: string;
  user_id: string;
  course_id: number;
  center_id: number;
  tb_id: number;
  act_type: string;
  act_descrip: string;
  act_content: string;
  act_on: string;
  center_name: string;
  course_name: string;
  tb_name: string;
}
interface Statistics {
  enrolled: number;
  active: number; // changed from activeLMS to active
  inactive: number;
  suspended: number;
  stories?: number;
  batchEarning?: number;
  assignments?: number;
  allTickets?: number;
  unAnswered?: number;
  submissions?: number;
}
interface AdminDashboardProps {
  openForm: (formName: string) => void;
}
interface StudentTableProps {
  user_type: string;
  center_name: string;
  course_name: string;
  user_name: string;
  user_email: string;
  user_profile_photo: string;
  user_status: string;
  std_lms_status: string;
}

const STORAGE_KEYS = {
  STUDENTS: (batchId: number) => `dashboard_students_${batchId}`,
  STATISTICS: (batchId: number) => `dashboard_statistics_${batchId}`,
  ACTIVITY_LOGS: (batchId: number) => `dashboard_activity_logs_${batchId}`,
  CACHE_TIMESTAMP: (batchId: number) => `dashboard_cache_timestamp_${batchId}`,
};

// Simplified cache validation function
const isCacheValid = (batchId: number) => {
  const timestamp = localStorage.getItem(STORAGE_KEYS.CACHE_TIMESTAMP(batchId));

  if (!timestamp) return false;

  // Check if cache is less than 30 minutes old
  const cacheTime = parseInt(timestamp, 10);
  const now = Date.now();
  return now - cacheTime < 30 * 60 * 1000; // 30 minutes
};

// Add a color mapping helper function
const mapColorToThemeVariable = (color: string): string => {
  switch (color) {
    case "#00c4b4":
      return "bg-[hsl(var(--teal-light))] text-[hsl(var(--teal))]";
    case "#00c67d":
      return "bg-[hsl(var(--success-light))] text-[hsl(var(--success))]";
    case "#ff8e6e":
      return "bg-[hsl(var(--accent))/0.15] text-[hsl(var(--accent))]";
    case "#ff6b7d":
      return "bg-[hsl(var(--destructive))/0.15] text-[hsl(var(--destructive))]";
    default:
      return "bg-[hsl(var(--primary))/0.15] text-[hsl(var(--primary))]";
  }
};

// Add this helper function near the other utility functions
const formatNumber = (value: number): string => {
  return Number(value).toFixed(2);
};

const CenterUserDashboard = ({ openForm }: AdminDashboardProps) => {
  const [mockActivityData, setMockActivityData] = useState<ActivityLog[]>([]);
  const [students, setStudents] = useState<StudentTableProps[]>([]);
  const { selectedBatchId, setStudentStatus, user_id, userType } = useBatch();
  const [columns, setColumns] = useState<Column[]>(
    DEFAULT_ACTIVITY_LOG_COLUMNS
  );
  const [statistics, setStatistics] = useState<Statistics>({
    enrolled: 0,
    inactive: 0,
    suspended: 0,
    active: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  const formatDateTime = (timestamp: string): string => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(timestamp));
  };
  // Updated clear cache function to only clear specific batch data
  const clearDashboardCache = (batchId: number) => {
    localStorage.removeItem(STORAGE_KEYS.STUDENTS(batchId));
    localStorage.removeItem(STORAGE_KEYS.STATISTICS(batchId));
    localStorage.removeItem(STORAGE_KEYS.ACTIVITY_LOGS(batchId));
    localStorage.removeItem(STORAGE_KEYS.CACHE_TIMESTAMP(batchId));
  };

  const fetchActvityLogs = async () => {
    try {
      setIsLoading(true);

      // Check if we have valid cached data first
      // if (isCacheValid(selectedBatchId)) {
      //   const cachedLogs = localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOGS(selectedBatchId));
      //   const cachedStats = localStorage.getItem(STORAGE_KEYS.STATISTICS(selectedBatchId));

      //   if (cachedLogs && cachedStats) {
      //     setMockActivityData(JSON.parse(cachedLogs));
      //     setStatistics(JSON.parse(cachedStats));
      //     setIsLoading(false);
      //     return;
      //   }
      // }

      // If no valid cache, fetch from API
      const response = await getCenterUserDashoard(user_id, selectedBatchId);

      if (response && response.statistics) {
        // Extract data we need
        const activityLogs = response.activityLogs;
        const stats = response.statistics;

        // Update state
        setMockActivityData(activityLogs);
        setStatistics(stats);

        try {
          // Store in localStorage with timestamps
          localStorage.setItem(
            STORAGE_KEYS.ACTIVITY_LOGS(selectedBatchId),
            JSON.stringify(activityLogs)
          );
          localStorage.setItem(
            STORAGE_KEYS.STATISTICS(selectedBatchId),
            JSON.stringify(stats)
          );
          localStorage.setItem(
            STORAGE_KEYS.CACHE_TIMESTAMP(selectedBatchId),
            Date.now().toString()
          );
        } catch (storageError) {
          // Handle storage errors (like quota exceeded)
          console.warn("Failed to cache activity logs data:", storageError);

          // Clean up storage if needed
          clearDashboardCache(selectedBatchId);
        }
      } else {
        console.error("Invalid activity logs response format");
      }
    } catch (error) {
      console.error("Error fetching activity logs:", error);

      // Try to fall back to cached data even if expired
      const cachedLogs = localStorage.getItem(
        STORAGE_KEYS.ACTIVITY_LOGS(selectedBatchId)
      );
      const cachedStats = localStorage.getItem(
        STORAGE_KEYS.STATISTICS(selectedBatchId)
      );

      if (cachedLogs && cachedStats) {
        setMockActivityData(JSON.parse(cachedLogs));
        setStatistics(JSON.parse(cachedStats));
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBatchId >= 0) {
      fetchActvityLogs();
    }
    // No need to clear cache on unmount as it's now batch-specific
  }, [selectedBatchId]);

  return (
    <div className="max-w-8xl mx-auto mt-10 px-4 py-6">
      {isLoading ? (
        <Loader />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 content-start animate-fade-in">
            <StatCard
              title="Enrolled"
              value={(statistics?.enrolled ?? 0).toString()}
              icon={<User size={48} />}
              themeColor="teal"
              onClick={() => {
                openForm("StudentTable");
                setStudentStatus(1);
              }}
            />
            <StatCard
              title="Active"
              value={(statistics?.active ?? 0).toString()}
              icon={<CheckCircle size={48} />}
              themeColor="teal"
              onClick={() => {
                openForm("StudentTable");
                setStudentStatus(1);
              }}
            />
            <StatCard
              title="In-Active"
              value={(statistics?.inactive ?? 0).toString()}
              icon={<User size={48} />}
              themeColor="accent"
              onClick={() => {
                openForm("StudentTable");
                setStudentStatus(0);
              }}
            />
            <StatCard
              title="Suspended"
              value={(statistics?.suspended ?? 0).toString()}
              icon={<User size={48} />}
              themeColor="pink"
              onClick={() => {
                openForm("StudentTable");
                setStudentStatus(2);
              }}
            />
            <StatCard
              title="Stories"
              value={(statistics?.stories ?? 0).toString()}
              icon={<User size={48} />}
              themeColor="navy"
              onClick={() => openForm("EarningsReports")}
            />
            <StatCard
              title="Batch Earning"
              value={formatNumber(statistics?.batchEarning ?? 0)}
              icon={<CheckCircle size={48} />}
              themeColor="teal"
              onClick={() => openForm("EarningsReports")}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CenterUserDashboard;
