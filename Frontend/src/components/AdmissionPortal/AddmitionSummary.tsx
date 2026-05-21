import React, { useEffect, useState } from "react";
import {
  Users,
  UserCheck,
  UserX,
  ClipboardList,
  Ban,
  UserPlus,
  ChevronDown,
} from "lucide-react";
import {
  getCandidateProfile,
  getSelectedCandidateProfile,
} from "../../services/api";
import { useBatch } from "../../context/BatchContext";
import { DataTable } from "./DataTable";
import { Column, FilterBy, FilterStatus } from "../../types/columns";
import { DEFAULT_COLUMNS, DEFAULT_FILTER_BY } from "../../utils/tableUtils";
import InterviewPortal from "./InterviewPortal";

// Import components using require() for JSX files to avoid TypeScript errors
import { GenderSummary } from "./GenderSummary";
import { CourseSummary } from "./CourseSummary";
import { CenterSummary } from "./CenterSummary";
import { DivisionsSummary } from "./DivisionsSummary";

interface AdmissionPortalProps {
  tb_id: number;
}

// Add SummaryCard component
interface SummaryCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  color: string;
  delay: number;
}

const SummaryCard = ({
  title,
  value,
  icon: Icon,
  color,
  delay,
}: SummaryCardProps) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  // Map the color prop to CSS variables
  const getColorClasses = (colorName: string) => {
    switch (colorName) {
      case "text-blue-600":
        return {
          text: "text-[hsl(var(--navy))]",
          bg: "bg-[hsl(var(--navy-light))]",
        };
      case "text-green-600":
        return {
          text: "text-[hsl(var(--teal))]",
          bg: "bg-[hsl(var(--teal-light))]",
        };
      case "text-red-600":
      case "text-red-500":
        return {
          text: "text-[hsl(var(--pink))]",
          bg: "bg-[hsl(var(--pink-light))]",
        };
      case "text-orange-600":
        return {
          text: "text-[hsl(var(--accent))]",
          bg: "bg-[hsl(var(--accent))/0.15]",
        };
      case "text-purple-600":
        return {
          text: "text-[hsl(var(--primary))]",
          bg: "bg-[hsl(var(--primary))/0.15]",
        };
      default:
        return {
          text: "text-[hsl(var(--primary))]",
          bg: "bg-[hsl(var(--primary))/0.15]",
        };
    }
  };

  const colorClasses = getColorClasses(color);

  return (
    <div
      className={`card-hover bg-[hsl(var(--card))] border border-[hsl(var(--border))] p-4 sm:p-6 rounded-xl shadow-sm transition-all duration-300 
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
    >
      <div className="flex items-center justify-between group">
        <div className="flex-1">
          <p className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))] font-medium tracking-wide">
            {title}
          </p>
          <p
            className={`text-xl sm:text-3xl font-bold mt-2 ${colorClasses.text} stat-value tracking-tight`}
          >
            {value}
          </p>
        </div>
        <div
          className={`p-3 sm:p-4 rounded-xl ${colorClasses.bg} transition-all duration-300 group-hover:scale-110 animate-float`}
        >
          <Icon
            className={`w-6 h-6 sm:w-8 sm:h-8 ${colorClasses.text}`}
            strokeWidth={1.5}
          />
        </div>
      </div>
    </div>
  );
};

function AddmitionSummary() {
  const [candidateData, setCandidateData] = useState({
    totalCandidates: 0,
    passedCandidates: 0,
    failedCandidates: 0,
    testNotAttempted: 0,
    rejectedApplications: 0,
    appliedToday: 0,
    genderStats: {
      male: { total: 0, passed: 0 },
      female: { total: 0, passed: 0 },
    },
    courseStats: {},
    centerStats: {},
    divisionStats: {},
    candidates: [],
    // Add admission-specific statistics
    admissionsStats: {
      interviewsTaken: 0,
      recommended: 0,
      notRecommended: 0,
      rejected: 0,
      haveLaptop: 0,
      noLaptop: 0,
    },
  });

  const { selectedBatchId } = useBatch();
  const { selectedBatchName } = useBatch();
  const [activeTab, setActiveTab] = useState("applicationsSummary");
  const [isSubmenuOpen, setIsSubmenuOpen] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [columns, setColumns] = useState<Column[]>(DEFAULT_COLUMNS);
  const [filterBy, setFilterBy] = useState<FilterBy[]>(DEFAULT_FILTER_BY);

  const toggleSubmenu = (menu: string) => {
    setIsSubmenuOpen(isSubmenuOpen === menu ? null : menu);
  };

  const fetchCandidateProfile = async () => {
    try {
      // Extract tb_id from props
      const response = await getSelectedCandidateProfile(selectedBatchId);

      const { statistics, candidates } = response;
      setCandidateData({
        totalCandidates: statistics.applicationSummary.totalApplied,
        passedCandidates: statistics.applicationSummary.passed,
        failedCandidates: statistics.applicationSummary.failed,
        testNotAttempted: statistics.applicationSummary.testNotAttempted,
        rejectedApplications: statistics.applicationSummary.rejected,
        appliedToday: statistics.applicationSummary.appliedToday,
        genderStats: {
          male: {
            total: statistics.genderSummary.male.total,
            passed: statistics.genderSummary.male.passed,
          },
          female: {
            total: statistics.genderSummary.female.total,
            passed: statistics.genderSummary.female.passed,
          },
        },
        courseStats: statistics.courseSummary,
        centerStats: statistics.centerSummary,
        divisionStats: statistics.divisionSummary,
        candidates: candidates,
        admissionsStats: {
          interviewsTaken: statistics.interviewSummary.interviewsTaken,
          recommended: statistics.interviewSummary.recommended,
          notRecommended: statistics.interviewSummary.notRecommended,
          rejected: statistics.interviewSummary.rejected,
          haveLaptop: statistics.interviewSummary.haveLaptop,
          noLaptop: statistics.interviewSummary.noLaptop,
        },
      });
    } catch (err) {
      console.error("Error fetching candidate profile:", err);
    }
  };

  const getAdmissionStatusText = (status: number) => {
    switch (status) {
      case 2:
        return "Rejected";
      case 1:
        return "Recommended";
      case 0:
      default:
        return "TBD";
    }
  };

  // Function to process candidate data for admissions summary
  const processAdmissionsData = (candidates: any[]) => {
    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return {
        interviewsTaken: 0,
        recommendedCandidates: 0,
        notRecommendedCandidates: 0,
        rejectedApplications: 0,
        laptopOwners: 0,
        noLaptop: 0,
      };
    }

    let interviewsTaken = 0;
    let recommendedCandidates = 0;
    let notRecommendedCandidates = 0;
    let rejectedApplications = 0;
    let laptopOwners = 0;
    let noLaptop = 0;

    candidates.forEach((candidate) => {
      const hasInterviewDate =
        candidate.interview_date && candidate.interview_date !== "";
      const hasInterviewMarks =
        candidate.cand_interview_marks &&
        candidate.cand_interview_marks !== "TBD" &&
        candidate.cand_interview_marks !== "";

      if (hasInterviewDate || hasInterviewMarks) {
        interviewsTaken++;

        if (candidate.recommended === "1") {
          recommendedCandidates++;
        } else if (candidate.recommended === "0") {
          notRecommendedCandidates++;
        }
      }

      // Use the existing properties if available, otherwise use nested objects
      candidate.center_name =
        candidate.center_name || candidate.centers?.center_name || "";
      candidate.course_name =
        candidate.course_name || candidate.courses?.course_name || "";
      candidate.course_full_name =
        candidate.courses?.course_full_name || candidate.course_name || "";

      // Add admission status text
      candidate.admission_status_text = getAdmissionStatusText(
        candidate.cand_admission_status
      );

      if (candidate.cand_admission_status === 2) {
        rejectedApplications++;
      }

      if (candidate.laptop_pc === "1") {
        laptopOwners++;
      } else if (candidate.laptop_pc === "0") {
        noLaptop++;
      }
    });

    return {
      interviewsTaken,
      recommendedCandidates,
      notRecommendedCandidates,
      rejectedApplications,
      laptopOwners,
      noLaptop,
    };
  };

  useEffect(() => {
    fetchCandidateProfile();
  }, [selectedBatchId]);

  return (
    <div className="h-screen flex flex-col bg-mesh">
      <main className="flex-1 overflow-auto bg-[hsl(var(--background))]">
        {/* Render different content based on activeTab */}

        <div className="container mx-auto px-4 sm:px-8 py-6 sm:py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-6 mb-6 sm:mb-10">
            {[
              {
                title: "Interviews Taken",
                value: candidateData.admissionsStats.interviewsTaken.toString(),
                icon: Users,
                color: "text-blue-600",
                delay: 100,
              },
              {
                title: "Recommended",
                value:
                  candidateData.admissionsStats.recommended.toString(),
                icon: UserCheck,
                color: "text-green-600",
                delay: 200,
              },
              {
                title: "Not Recommended",
                value:
                  candidateData.admissionsStats.notRecommended.toString(),
                icon: UserX,
                color: "text-red-600",
                delay: 300,
              },
              {
                title: "Rejected",
                value:
                  candidateData.admissionsStats.rejected.toString(),
                icon: ClipboardList,
                color: "text-orange-600",
                delay: 400,
              },
              {
                title: "Have Laptop/PC",
                value: candidateData.admissionsStats.haveLaptop.toString(),
                icon: Users,
                color: "text-purple-600",
                delay: 500,
              },
              {
                title: "No Laptop/PC",
                value: candidateData.admissionsStats.noLaptop.toString(),
                icon: Ban,
                color: "text-red-500",
                delay: 600,
              },
            ].map((card, index) => (
              <SummaryCard key={index} {...card} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-6 sm:mb-8">
            <GenderSummary genderStats={candidateData.genderStats} />
            <CourseSummary courseStats={candidateData.courseStats} />
          </div>

          <div className="mb-6 sm:mb-8">
            <CenterSummary centerStats={candidateData.centerStats} />
          </div>

          <div className="mb-6">
            <DivisionsSummary divisionStats={candidateData.divisionStats} />
          </div>
        </div>
      </main>
    </div>
  );
}

export default AddmitionSummary;
