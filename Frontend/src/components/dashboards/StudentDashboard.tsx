import { useEffect, useState, useRef } from "react";
import {
  DollarSign,
  FileText,
  Clock,
  Database,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useBatch } from "../../context/BatchContext";
import { getStudentDashboardData, createCertificate } from "../../services/api";
import StatCard from "./StudentDashboardItems/StatCard";
import StudentDataChart from "./StudentDashboardItems/StudentDataChart";
import DiscussionItem from "./StudentDashboardItems/DiscussionItem";
import StatsTable from "./StudentDashboardItems/StatsTable";
import AnnouncementCard from "./StudentDashboardItems/AnnouncementCard";
import TicketsTable from "./StudentDashboardItems/TicketsTable";
import AssignmentsCard from "./StudentDashboardItems/AssignmentsCard";
import WhatsNewCard from "./StudentDashboardItems/WhatsNewCard";
import Loader from "../Loader";
import confetti from "canvas-confetti";


interface AdminDashboardProps {
  openForm: (formName: string) => void;
}

export interface DashboardData {
  success?: boolean;
  documents_uploaded?: boolean;
  missing_documents?: string[];
  required_documents?: string[];
  uploaded_documents?: string[];
  redirect_to?: string;
  message?: string;
  statistics: { label: string; value: string }[];
  recentAssignments: Array<{
    title: string;
    points: number;
    deadline: string;
  }>;
  latestAnnouncement: {
    ca_title: string;
    ca_message: string;
  } | null;
  quizPerformanceData: Array<{ name: string; value: number }>;
  assignmentPerformanceData: Array<{ name: string; value: number }>;
  courseProgressData: Array<{ name: string; value: number }>;
  givCertificate: boolean;
  dashboardStats: {
    earnings: number;
    pendingAssignments: number;
    pendingQuizzes: number;
    overallProgress: number;
    attendanceProgress: number;
    notSubmittedAssignments: number;
  };
  documentStatus?: {
    hasAllDocuments: boolean;
    missingDocuments: string[];
    requiredDocuments: string[];
    uploadedDocuments: string[];
  };
  // Add this property to match your backend response
  studentProfilebyCNIC?: {
    success: boolean;
    data: {
      user_id: number;
      user_name: string;
      user_username: string;
      user_email: string;
      user_type: string;
      user_status: number;
      user_profile_photo: string;
      std_id: number;
      course_id: number;
      course_name: string;
      course_full_name: string;
      course_status: number;
      std_added_on: string;
      center_name: string;
      std_cnic: string;
      center_id: number;
      tb_id: number;
      std_gender: string;
      std_qualification: string;
      std_district: string;
      std_phone: string;
      std_fathername: string;
      std_lms_status: number;
      std_forum_status: number;
      std_rollno: string;
      // ...other fields as needed...
    };
    statusCode: number;
  };
}

const STUDENT_DASHBOARD_CACHE_KEY = "studentDashboardData";
const CACHE_DURATION = 24 * 60 * 60 * 1000; 
const MAX_CACHE_ITEMS = 5; 

// Helper function to safely store in localStorage
const safelyStoreInLocalStorage = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.warn("LocalStorage quota exceeded. Clearing old cache items.");
    return false;
  }
};

// Function to clear oldest cached items to make space
const clearOldestCacheItems = () => {
  try {
    const allKeys = Object.keys(localStorage);
    const dashboardDataKeys = allKeys.filter((key) =>
      key.startsWith(STUDENT_DASHBOARD_CACHE_KEY)
    );

    if (dashboardDataKeys.length > MAX_CACHE_ITEMS) {
      // Sort by possible embedded timestamp or just remove the first ones
      dashboardDataKeys
        .slice(0, dashboardDataKeys.length - MAX_CACHE_ITEMS)
        .forEach((key) => localStorage.removeItem(key));
    }
  } catch (error) {
    console.error("Error clearing cache:", error);
  }
};

const StudentDashboard = ({ openForm }: AdminDashboardProps) => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isGeneratingCertificate, setIsGeneratingCertificate] = useState(false);
  const celebrationTimeout = useRef<NodeJS.Timeout | null>(null);
  const { user_id, selectedBatchId, userType } = useBatch();
  const date = new Date();

  const refreshDashboard = async () => {
    setIsRefreshing(true);
    await fetchDashboardData(true);
    setIsRefreshing(false);
  };

  const fetchDashboardData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null); // Clear any previous errors

      // Validate required parameters
      if (!user_id || !selectedBatchId) {
        throw new Error("Student ID or Batch ID is missing. Please select a batch.");
      }

      // Create a batch-specific cache key
      const cacheKey = `${STUDENT_DASHBOARD_CACHE_KEY}_${user_id}_${selectedBatchId}`;

      // Check localStorage first for cached data if not forcing refresh
      if (!forceRefresh) {
        try {
          const cachedData = localStorage.getItem(cacheKey);
          if (cachedData) {
            const { data, timestamp } = JSON.parse(cachedData);
            const isStillValid = Date.now() - timestamp < CACHE_DURATION;

            if (isStillValid) {
              setDashboardData(data);
              setError(null); // Clear any errors when data loads successfully
              setLoading(false);

              // Extract student info from cached data
              const studentInfo = {
                rollNumber:
                  data.statistics.find(
                    (stat: { label: string; value: string }) =>
                      stat.label === "Roll No."
                  )?.value || "",
                name:
                  data.statistics.find(
                    (stat: { label: string; value: string }) =>
                      stat.label === "Name."
                  )?.value || "",
              };
              safelyStoreInLocalStorage("studentInfo", studentInfo);
              return;
            }
          }
        } catch (err) {
          console.warn("Error reading from cache:", err);
          // Continue to fetch from API
        }
      }
      const response = await getStudentDashboardData(user_id, selectedBatchId, userType);

      // Cache document status for sidebar
      if (userType === "student") {
        const documentStatusCache = {
          documents_uploaded: response.documents_uploaded !== false,
          timestamp: Date.now()
        };
        localStorage.setItem(`documentStatus_${user_id}_${selectedBatchId}`, JSON.stringify(documentStatusCache));
      }

      setDashboardData(response);
      setError(null); // Clear any errors when data loads successfully
      const studentInfo = {
        rollNumber:
          response.statistics.find((stat) => stat.label === "Roll No.")
            ?.value || "",
        name:
          response.statistics.find((stat) => stat.label === "Name.")?.value ||
          "",
      };
      safelyStoreInLocalStorage("studentInfo", studentInfo);
      clearOldestCacheItems();
      const stored = safelyStoreInLocalStorage(cacheKey, {
        data: response,
        timestamp: Date.now(),
      });
      if (!stored) {
        const minimalData = {
          dashboardStats: response.dashboardStats,
          statistics: response.statistics,
        };

        safelyStoreInLocalStorage(cacheKey, {
          data: minimalData,
          timestamp: Date.now(),
          isReduced: true,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch dashboard data";
      setError(errorMessage);
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };
  const handleCreateCertificate = async () => {
    if (!dashboardData?.givCertificate) {
      setError("Certificate not available for this batch.");
      return;
    }
    try {
      setIsGeneratingCertificate(true);
      // Use studentProfilebyCNIC.data for certificate fields
      const profile = dashboardData.studentProfilebyCNIC?.data;
      if (!profile) {
        setError("Student profile data not found.");
        setIsGeneratingCertificate(false);
        return;
      }
      const certData = {
        name: profile.user_name,
        FatherName: profile.std_fathername,
        course: profile.course_full_name,
        startDate: profile.std_added_on
          ? new Date(profile.std_added_on).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "",
        endDate: "",
        center: profile.center_name,
        tb_id: profile.tb_id,
        course_id: profile.course_id,
        center_id: profile.center_id,
        gender: profile.std_gender,
      };
      const response = await createCertificate(certData);
      if (response.success) {
        setShowCelebration(true);
        confetti({
          particleCount: 200,
          spread: 90,
          origin: { y: 0.6 }
        });
        setTimeout(() => {
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.7 }
          });
        }, 500);
        celebrationTimeout.current = setTimeout(() => {
          setShowCelebration(false);
        }, 2000);
      } else {
        setError("Failed to create certificate. Please try again later.");
      }
    } catch (err) {
      setError("An error occurred while creating the certificate.");
      console.error(err);
    } finally {
      setIsGeneratingCertificate(false);
    }
  };
  

  useEffect(() => {
    if (user_id && selectedBatchId) {
      fetchDashboardData();
    }
  }, [user_id, selectedBatchId]);

  useEffect(() => {
    if (dashboardData?.givCertificate) {
      setShowCelebration(true);
      // Fire confetti
      confetti({
        particleCount: 200,
        spread: 90,
        origin: { y: 0.6 }
      });
      // Optionally, repeat for a burst effect
      setTimeout(() => {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.7 }
        });
      }, 500);
      // Hide after 2 seconds
      celebrationTimeout.current = setTimeout(() => {
        setShowCelebration(false);
      }, 2000);
    }
    return () => {
      if (celebrationTimeout.current) clearTimeout(celebrationTimeout.current);
    };
  }, [dashboardData?.givCertificate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader />
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
            onClick={() => fetchDashboardData(true)}
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
      {/* Celebration overlay */}
      {showCelebration && (
        <div
          style={{
            position: "fixed",
            zIndex: 9999,
            inset: 0,
            background: "rgba(255,255,255,0.2)",
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "3rem",
            fontWeight: "bold",
            color: "#22c55e",
            animation: "fadeOut 2s forwards"
          }}
        >
          🎉 Congratulations! 🎉
        </div>
      )}

      <div className="max-w-7xl mx-auto">
      { date.getDay() === 5 && (
        <div className="mb-4 p-3 bg-yellow-100 text-teal rounded border-l-4 border-yellow-500">
          <p className="font-medium">⚠️ Weekly Feedback Not Submitted</p>
          <p className="text-sm">
            Please submit your weekly feedback to keep your dashboard updated. 📋
          </p>
          <button
            onClick={() => openForm("StudentFeedback")}
            className="text-blue-600 underline text-sm"
          >
            Submit Now ➡️
          </button>
        </div>
      )}
       { dashboardData.givCertificate && (
        <div className="mb-4 p-3 bg-green-100 text-green-800 rounded border-l-4 border-green-500 flex items-center gap-4">
          <span className="text-2xl">🎉</span>
          <div>
            <p className="font-medium">Congratulations! Certificate Ready</p>
            <p className="text-sm">
              Your certificate is ready to be generated. Celebrate your achievement and download it now! 🏆
            </p>
            <button
              onClick={handleCreateCertificate}
              className="text-green-700 underline text-sm font-semibold mt-2 flex items-center gap-2"
              disabled={isGeneratingCertificate}
            >
              {isGeneratingCertificate && (
                <span className="animate-spin mr-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8z"
                    ></path>
                  </svg>
                </span>
              )}
              {isGeneratingCertificate ? "Generating..." : "Generate Now ➡️"}
            </button>
          </div>
        </div>
      )}
        {/* Add refresh button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={refreshDashboard}
            disabled={isRefreshing}
            className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
            />
            {isRefreshing ? "Refreshing..." : "Refresh Dashboard"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* My Earnings Card */}
          <StatCard
            icon={<DollarSign className="h-5 w-5" />}
            iconBgColor="bg-teal"
            title="My Earnings"
            titleColor="text-teal"
            value={`$${dashboardData.dashboardStats.earnings || 0}`}
            valueColor="text-teal"
            description="Submit your Earning"
            descriptionIcon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            bgColor="bg-teal-light"
            onClick={() => openForm("EarningsForm")}
          />

          {/* Pending Assignments Card */}
          <StatCard
            icon={<FileText className="h-5 w-5" />}
            iconBgColor="bg-pink"
            title="Pending Assignments"
            titleColor="text-pink"
            value={dashboardData.dashboardStats.notSubmittedAssignments.toString()}
            valueColor="text-pink"
            description="Complete before time ups"
            descriptionIcon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            bgColor="bg-pink-light"
            onClick={() => openForm("AssignmentList")}
          />

          {/* Answered Tickets Card */}
          <StatCard
            icon={<Clock className="h-5 w-5" />}
            iconBgColor="bg-teal"
            title="Answered Tickets"
            titleColor="text-teal"
            value="0"
            valueColor="text-teal"
            description="Troubles got answered"
            descriptionIcon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            }
            bgColor="bg-teal-light"
            onClick={() => openForm("Tickets")}
          />
          <StatCard
            icon={<FileText className="h-5 w-5" />}
            iconBgColor="bg-navy"
            title="Pending Quiz"
            titleColor="text-white"
            value={dashboardData.dashboardStats.pendingQuizzes.toString()}
            valueColor="text-white"
            description="Complete before time ups"
            descriptionIcon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
            bgColor="bg-navy-light"
            onClick={() => openForm("StudentQuizTable")}
          />
        </div>
        {/* Pending Assignments Card */}

        {/* Student Performance Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <StudentDataChart
            title="Course Progress"
            data={dashboardData.courseProgressData}
            type="bar"
            color="#00BFB3"
          />
          <StudentDataChart
            title="Quiz Performance"
            data={dashboardData.quizPerformanceData}
            type="line"
            color="#FF8B9A"
          />
          <StudentDataChart
            title="Assignment Distribution"
            data={dashboardData.assignmentPerformanceData}
            type="radar"
            color="#9B59B6"
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
                  text="Welcome to Batch-8 of the DigiBizz Program!"
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
            <StatsTable stats={dashboardData.statistics} />
          </div>

          <div className="lg:col-span-2 lg:row-span-1">
            {dashboardData.latestAnnouncement ? (
              <AnnouncementCard
                title={dashboardData.latestAnnouncement.ca_title}
                message={dashboardData.latestAnnouncement.ca_message}
                author="MK"
                date="Mareena Khan / 21-02-2025"
              />
            ) : (
              <div className="text-gray-500 text-center p-4 bg-gray-100 rounded-lg">
                No announcements available.
              </div>
            )}
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
          <AssignmentsCard assignments={dashboardData.recentAssignments} />
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
