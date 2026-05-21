import React, { useEffect, useState } from "react";
import { getEarningsByTBId, getEarningsReport } from "../../services/api";
import { useBatch } from "../../context/BatchContext";
import { Column, FilterBy, FilterStatus } from "../../types/columns";
import { DEFAULT_COLUMNS, DEFAULT_FILTER_BY } from "../../utils/tableUtils";
import { EarningsData } from "../../types/earningFormData";
import { EarningSubmissions } from "./EarningSubmissions";
import { Card, CardContent } from "../ui/card";
import { Wallet } from "lucide-react";
import { SuccessStories } from "./SuccessStories";
import BatchReport from "./BatchReport";
import MasterReport from "./MasterReport";
import Loader from "../Loader";
import { TopEarningData } from "./TopEarningData";
import { MasterEarningApprove } from "./MasterEarningApprove";
import { set } from "date-fns";

// Define interfaces for the new data structure
interface StudentStatistics {
  totalStudents: number;
  maleCount: number;
  femaleCount: number;
}

interface BatchDetails {
  trainingBatchId: string;
  totalEarnings: string;
  totalRejectedEarnings: string;
  totalPendingEarnings: string;
  studentStatistics: StudentStatistics;
}

interface CourseWiseEarning {
  course: string;
  amount: string;
}

interface CourseEarning {
  course: string;
  male: string;
  female: string;
  total: string;
}

interface CenterAnalytics {
  center: string;
  courseEarnings: CourseEarning[];
  totalEarnings: {
    male: string;
    female: string;
    total: string;
  };
}

interface TrainerPerformance {
  trainer: string;
  earnings: string;
  successStories: number;
  successOthers: number;
}

interface EarningRecord {
  earningId: number;
  studentId: number;
  studentName: string;
  studentImage: string;
  studentPhone: string;
  platform: string;
  amount: string;
  totalEarnings: string;
  date: string;
  status: string;
  earningStatus: number;
  proof: string;
  centerName: string;
  courseName: string;
  trainerName: string;
  trainerImage: string;
  trainingBatchName: string;
}

interface BatchTrainingStats {
  batchName: string;
  totalEarnings: string;
  centerWiseAnalytics: CenterAnalytics[];
  centerWiseSuccessStories: any[]; // Define proper type if needed
  trainerPerformance: TrainerPerformance[];
}

export interface EarningsDataState {
  success: boolean;
  batchDetails: BatchDetails;
  courseWiseEarnings: CourseWiseEarning[];
  centerWiseAnalytics: CenterAnalytics[];
  centerWiseSuccessStories: any[]; // Define proper type if needed
  trainerPerformance: TrainerPerformance[];
  earnings: EarningRecord[];
}
interface MasterEarningDataState {
  success: boolean;
  batchDetails: BatchDetails;
  courseWiseEarnings: CourseWiseEarning[];
  centerWiseAnalytics: CenterAnalytics[];
  centerWiseSuccessStories: any[]; // Define proper type if needed
  trainerPerformance: TrainerPerformance[];
  earnings: EarningRecord[];
  batchTrainingStats: BatchTrainingStats[];
}
function EarningPortal() {
  const [isLoading, setIsLoading] = useState(true);
  // Initialize state with all required fields
  const [earningData, setEarningsData] = useState<EarningsDataState>({
    success: false,
    batchDetails: {
      trainingBatchId: "",
      totalEarnings: "0.00",
      totalRejectedEarnings: "0.00",
      totalPendingEarnings: "0.00",
      studentStatistics: {
        totalStudents: 0,
        maleCount: 0,
        femaleCount: 0,
      },
    },
    courseWiseEarnings: [],
    centerWiseAnalytics: [],
    centerWiseSuccessStories: [],
    trainerPerformance: [],
    earnings: [],
  });
  const [masterEarningData, setMasterEarningData] =
    useState<MasterEarningDataState>({
      success: false,
      batchDetails: {
        trainingBatchId: "",
        totalEarnings: "0.00",
        totalRejectedEarnings: "0.00",
        totalPendingEarnings: "0.00",
        studentStatistics: {
          totalStudents: 0,
          maleCount: 0,
          femaleCount: 0,
        },
      },
      courseWiseEarnings: [],
      centerWiseAnalytics: [],
      centerWiseSuccessStories: [],
      trainerPerformance: [],
      batchTrainingStats: [],
      earnings: [],
    });

  const {
    selectedBatchId,
    earningStatus,
    selectedBatchName,
    userType,
    user_id,
  } = useBatch();
  const [activeTab, setActiveTab] = useState("EarningSubmissions");

  const [isSubmenuOpen, setIsSubmenuOpen] = useState<string | null>(null);
  const { course_id } = useBatch();
  const toggleSubmenu = (menu: string) => {
    setIsSubmenuOpen(isSubmenuOpen === menu ? null : menu);
  };
  useEffect(() => {
    if (userType === "trainer") {
      setActiveTab("MasterSuccessStories");
    }
  }, [userType]);
  const getStatusText = (statusCode: number) => {
    switch (statusCode) {
      case 0:
        return "Pending";
      case 1:
        return "Approved";
      case 2:
        return "Not Approved";
      default:
        return "Unknown";
    }
  };

  const fetchEarningsData = async () => {
    setIsLoading(true);
    try {
      const response = await getEarningsByTBId(selectedBatchId, user_id);

      if (response.success) {
        setEarningsData({
          success: response.success,
          batchDetails: response.batchDetails,
          courseWiseEarnings: response.courseWiseEarnings || [],
          centerWiseAnalytics: response.centerWiseAnalytics || [],
          centerWiseSuccessStories: response.centerWiseSuccessStories || [],
          trainerPerformance: response.trainerPerformance || [],
          earnings: response.earnings.map((earning: any) => ({
            earningId: earning.earningId,
            studentId: earning.studentId,
            studentName: earning.studentName,
            studentImage: earning.studentImage,
            studentPhone: earning.studentPhone,
            platform: earning.platform,
            amount: earning.amount,
            totalEarnings: earning.totalEarnings,
            date: earning.date,
            status: getStatusText(earning.status),
            earningStatus: earning.status,
            proof: earning.proof,
            centerName: earning.centerName,
            courseName: earning.courseName,
            trainerName: earning.trainerName,
            trainerImage: earning.trainerImage,
            trainingBatchName: earning.trainingBatchName,
          })),
        });
      }
    } catch (err) {
      console.error("Error fetching earnings data:", err);
    } finally {
      setIsLoading(false);
    }
  };
  const fetchMasterEarningData = async () => {
    setIsLoading(true);
    try {
      const response = await getEarningsReport();

      if (response.success) {
        setMasterEarningData({
          success: response.success,
          batchDetails: response.batchDetails,
          courseWiseEarnings: response.courseWiseEarnings || [],
          centerWiseAnalytics: response.centerWiseAnalytics || [],
          centerWiseSuccessStories: response.centerWiseSuccessStories || [],
          trainerPerformance: response.trainerPerformance || [],
          batchTrainingStats: response.batchTrainingStats || [],
          earnings: response.earnings.map((earning: any) => ({
            earningId: earning.earningId,
            studentId: earning.studentId,
            studentName: earning.studentName,
            studentImage: earning.studentImage,
            studentPhone: earning.studentPhone,
            gender: earning.gender,
            platform: earning.platform,
            amount: earning.amount,
            totalEarnings: earning.totalEarnings,
            date: earning.date,
            status: getStatusText(earning.status),
            earningStatus: earning.status,
            proof: earning.proof,
            centerName: earning.centerName,
            courseName: earning.courseName,
            trainerName: earning.trainerName,
            trainerImage: earning.trainerImage,
            trainingBatchName: earning.trainingBatchName,
          })),
        });
      }
    } catch (err) {
      console.error("Error fetching earnings data:", err);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    fetchEarningsData();
  }, [selectedBatchId, earningStatus]);
  useEffect(() => {
    if (selectedBatchId >= 0) {
      fetchMasterEarningData();
    }
  }, [earningStatus, selectedBatchId]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-mesh">
        <Loader />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-mesh">
      <header className="header-gradient text-white px-4 sm:px-8 py-4 sm:py-6 shadow-lg flex-none">
        <div className="container mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Earnings Reports {selectedBatchName}
          </h1>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-s text-gray-100 font-medium">
                Total Approved Earnings
              </p>
              <h3 className="text-4xl text-gray-100 font-bold">
                $
                {activeTab === "EarningMasterReport"
                  ? masterEarningData.batchDetails.totalEarnings
                  : earningData.batchDetails.totalEarnings}
              </h3>
            </div>
            <div>
              <p className="text-s text-gray-100 font-medium">
                Total Rejected Earnings
              </p>
              <h3 className="text-4xl text-gray-100 font-bold ">
                $
                {activeTab === "EarningMasterReport"
                  ? masterEarningData.batchDetails.totalRejectedEarnings
                  : earningData.batchDetails.totalRejectedEarnings}
              </h3>
            </div>
            <div>
              <p className="text-s text-gray-100 font-medium">
                Total Pending Earnings
              </p>
              <h3 className="text-4xl text-gray-100 font-bold">
                $
                {activeTab === "EarningMasterReport"
                  ? masterEarningData.batchDetails.totalPendingEarnings
                  : earningData.batchDetails.totalPendingEarnings}
              </h3>
            </div>
            <Wallet className="h-8 w-8 text-white" />
          </div>
        </div>
      </header>
      <nav className="bg-white shadow-md">
        <div className="container mx-auto px-4">
          <div className="flex items-center space-x-4 h-14">
            {userType !== "trainer" && (
            <>
            <button
              onClick={() => setActiveTab("EarningSubmissions")}
              className={`px-3 py-2 text-[#016e4c] rounded-md hover:bg-gray-100 ${
                activeTab === "EarningSubmissions" ? "bg-gray-100" : ""
              }`}
            >
              Earning Submissions
            </button>
            <button
              onClick={() => setActiveTab("SuccessStories")}
              className={`px-3 py-2 text-[#016e4c] rounded-md hover:bg-gray-100 ${
                activeTab === "SuccessStories" ? "bg-gray-100" : ""
              }`}
            >
              Success Stories
            </button>
            </>
            )}
            {((userType === "SuperAdmin" || userType === "ContentAdmin") || course_id === 3) &&(
             <button
              onClick={() => setActiveTab("MasterSuccessStories")}
              className={`px-3 py-2 text-[#016e4c] rounded-md hover:bg-gray-100 ${
                activeTab === "MasterSuccessStories" ? "bg-gray-100" : ""
              }`}
            >
              Master Success Stories
            </button>
            )}
            { userType !== "trainer" && (
            <>
            <button
              onClick={() => setActiveTab("BatchReport")}
              className={`px-3 py-2 text-[#016e4c] rounded-md hover:bg-gray-100 ${
                activeTab === "BatchReport" ? "bg-gray-100" : ""
              }`}
            >
              Batch Report
            </button>
            {userType === "SuperAdmin" && (
              <button
                onClick={() => setActiveTab("TopEarningData")}
                className={`px-3 py-2 text-[#016e4c] rounded-md hover:bg-gray-100 ${
                  activeTab === "TopEarningData" ? "bg-gray-100" : ""
                }`}
              >
                Top Earner's Data
              </button>
            )}
            {userType !== "MasterTrainer" && (
              <button
                onClick={() => setActiveTab("EarningMasterReport")}
                className={`px-3 py-2 text-[#016e4c] rounded-md hover:bg-gray-100 ${
                  activeTab === "EarningMasterReport" ? "bg-gray-100" : ""
                }`}
              >
                Master Report
              </button>
            )}
            </>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1 overflow-auto">
        {userType !== "trainer" && (
        <>
        {activeTab === "EarningSubmissions" && (
          <EarningSubmissions data={earningData.earnings} />
        )}
        {activeTab === "SuccessStories" && (
          <SuccessStories
            data={earningData.earnings.filter(
              (earning) => earning.earningStatus === 1
            )}
          />
        )}
        </>
        )}
        {activeTab === "MasterSuccessStories" && (
          <MasterEarningApprove
            data={masterEarningData.earnings.filter(
              (earning) => earning.earningStatus === 1
            )}
          />
        )}
        {userType !== "trainer" && (
        <>
        {activeTab === "BatchReport" && (
          <BatchReport
            courseWiseEarnings={earningData.courseWiseEarnings}
            centerWiseAnalytics={earningData.centerWiseAnalytics}
            centerWiseSuccessStories={earningData.centerWiseSuccessStories}
            trainerPerformance={earningData.trainerPerformance}
            studentStatistics={earningData.batchDetails.studentStatistics}
            // ganderPerformance =
          />
        )}
        {activeTab === "TopEarningData" && userType === "SuperAdmin" && (
          <TopEarningData
            data={masterEarningData.earnings.filter(
              (earning) =>
                parseFloat(earning.totalEarnings) >= 5000 &&
                earning.earningStatus === 1
            )}
          />
        )}
        {userType !== "MasterTrainer" && (
          <>
            {activeTab === "EarningMasterReport" && (
              <MasterReport
                courseWiseEarnings={masterEarningData.courseWiseEarnings}
                centerWiseAnalytics={masterEarningData.centerWiseAnalytics}
                centerWiseSuccessStories={
                  masterEarningData.centerWiseSuccessStories
                }
                trainerPerformance={masterEarningData.trainerPerformance}
                batchTrainingStats={masterEarningData.batchTrainingStats}
                studentStatistics={
                  masterEarningData.batchDetails.studentStatistics
                }
              />
            )}
          </>
        )}
        </>
        )}
      </main>
    </div>
  );
}

export default EarningPortal;
