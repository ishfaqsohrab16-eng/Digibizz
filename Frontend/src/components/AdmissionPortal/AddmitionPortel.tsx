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
import AddmitionSummary from "./AddmitionSummary";
import CenterDomainChange from "./CenterDomainChange";
import EnrollCandidateDialog from "./EnrollCandidateDialog";
import { isAdmin } from "../../utils/roles";

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

// Add this type or import your real Candidate type if available
type Candidate = any;

function AdmissionPortal() {
  const [candidateData, setCandidateData] = useState<{
    totalCandidates: number;
    passedCandidates: number;
    failedCandidates: number;
    testNotAttempted: number;
    rejectedApplications: number;
    appliedToday: number;
    genderStats: {
      male: { total: number; passed: number };
      female: { total: number; passed: number };
    };
    courseStats: any;
    centerStats: any;
    divisionStats: any;
    candidates: Candidate[];
  }>({
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
  });

  const { selectedBatchId, userType } = useBatch();
  const { selectedBatchName } = useBatch();
  const [activeTab, setActiveTab] = useState("applicationsSummary");
  const [isSubmenuOpen, setIsSubmenuOpen] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [columns, setColumns] = useState<Column[]>(DEFAULT_COLUMNS);
  const [filterBy, setFilterBy] = useState<FilterBy[]>(DEFAULT_FILTER_BY);
  const [candidateToEnroll, setCandidateToEnroll] = useState<number | null>(null);

  // Enrolling creates a real student and LMS account, so it is limited to the
  // admin-style roles. The server enforces the same list.
  const canEnroll = isAdmin(userType);

  const toggleSubmenu = (menu: string) => {
    setIsSubmenuOpen(isSubmenuOpen === menu ? null : menu);
  };

  /**
   * The interview panel stores the recommendation as the string "Yes"/"No",
   * and the server enforces the same value before it will enrol anyone. The
   * table relabels it for display, so the raw answer is normalised here once
   * and kept alongside it for the Enroll guard to use.
   */
  const isRecommended = (value: unknown) =>
    String(value ?? "").trim().toLowerCase() === "yes";

  const fetchCandidateProfile = async () => {
    try {
      // Extract tb_id from props
      const response = await getCandidateProfile(selectedBatchId);
      const { statistics, candidates } = response;

      // Update cand_interview_marks to "TBD" if null, "", or undefined
      const updatedCandidates = Array.isArray(candidates)
        ? candidates.map((candidate) => ({
            ...candidate,
            cand_interview_marks:
              candidate.cand_interview_marks === null ||
              candidate.cand_interview_marks === "" ||
              candidate.cand_interview_marks === undefined
                ? "TBD"
                : candidate.cand_interview_marks,
            is_recommended: isRecommended(candidate.recommended),
            recommended: isRecommended(candidate.recommended)
              ? "Recommended"
              : String(candidate.recommended ?? "").trim().toLowerCase() === "no"
              ? "Not Recommend"
              : "",
          }))
        : [];

      processAdmissionsData(updatedCandidates);
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
        candidates: updatedCandidates,
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

      // Correctly handle nested objects for centers and courses

      candidate.center_name = candidate.centers.center_name;
      candidate.course_name = candidate.courses.course_name;
      candidate.course_full_name = candidate.courses.course_full_name;
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

  // Refetch on tab change as well as on batch change: recommending someone in
  // the interview panel happens in a sibling tab, so without this the list
  // still holds the pre-interview rows and Enroll stays disabled.
  useEffect(() => {
    fetchCandidateProfile();
  }, [selectedBatchId, activeTab]);

  return (
    <div className="h-screen flex flex-col bg-mesh">
      <header className="header-gradient text-white px-4 sm:px-8 py-4 sm:py-6 shadow-lg flex-none">
        <div className="container mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Admissions Portal {selectedBatchName}
          </h1>
          {/* <p className="text-blue-100 mt-2 text-sm sm:text-base">
            {selectedBatchName}
          </p> */}
        </div>
      </header>

      {/* Navigation Bar */}
      <nav className="bg-[hsl(var(--card))] border-b border-[hsl(var(--border))] shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center space-x-4 h-14">
            {/* Summary Dropdown */}
            <div className="relative">
              <button
                onClick={() => toggleSubmenu("summary")}
                className={`flex items-center space-x-1 px-3 py-2 rounded-md hover:bg-[hsl(var(--muted))] transition-colors ${
                  isSubmenuOpen === "summary" ? "bg-[hsl(var(--muted))]" : ""
                }`}
              >
                <span className="text-[hsl(var(--foreground))]">Summary</span>
                <ChevronDown className="w-4 h-4 text-[hsl(var(--foreground))]" />
              </button>
              {isSubmenuOpen === "summary" && (
                <div className="absolute z-10 left-0 mt-2 w-48 bg-[hsl(var(--card))] rounded-md shadow-lg py-1 border border-[hsl(var(--border))]">
                  <button
                    onClick={() => setActiveTab("admissionsSummary")}
                    className="block w-full text-left px-4 py-2 text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
                  >
                    Admissions Summary
                  </button>
                  <button
                    onClick={() => setActiveTab("applicationsSummary")}
                    className="block w-full text-left px-4 py-2 text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
                  >
                    Applications Summary
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setActiveTab("allCandidates")}
              className="px-3 py-2 rounded-md text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
            >
              Candidates
            </button>
            <button
              onClick={() => setActiveTab("centerDomainChange")}
              className="px-3 py-2 rounded-md text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
            >
              Center/Domain Change
            </button>

            {/* Interview Panel */}
            <button
              onClick={() => setActiveTab("interviewPanel")}
              className="px-3 py-2 rounded-md text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
            >
              Interview Panel
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 overflow-auto bg-[hsl(var(--background))]">
        {/* Render different content based on activeTab */}
        {activeTab === "applicationsSummary" && (
          <div className="container mx-auto px-4 sm:px-8 py-6 sm:py-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-6 mb-6 sm:mb-10">
              {[
                {
                  title: "Candidates Applied",
                  value: candidateData.totalCandidates.toString(),
                  icon: Users,
                  color: "text-blue-600",
                  delay: 100,
                },
                {
                  title: "Passed Candidates",
                  value: candidateData.passedCandidates.toString(),
                  icon: UserCheck,
                  color: "text-green-600",
                  delay: 200,
                },
                {
                  title: "Failed Candidates",
                  value: candidateData.failedCandidates.toString(),
                  icon: UserX,
                  color: "text-red-600",
                  delay: 300,
                },
                {
                  title: "Test Not Attempted",
                  value: candidateData.testNotAttempted.toString(),
                  icon: ClipboardList,
                  color: "text-orange-600",
                  delay: 400,
                },
                {
                  title: "Rejected Applications",
                  value: candidateData.rejectedApplications.toString(),
                  icon: Ban,
                  color: "text-red-600",
                  delay: 500,
                },
                {
                  title: "Applied Today",
                  value: candidateData.appliedToday.toString(),
                  icon: UserPlus,
                  color: "text-purple-600",
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
        )}
        {/* Add conditional rendering for other tabs */}
        {activeTab === "admissionsSummary" && <AddmitionSummary />}
        {activeTab === "allCandidates" && (
          <DataTable
            data={candidateData.candidates}
            columns={columns}
            filterStatus={filterStatus}
            setColumns={setColumns}
            setFilterStatus={setFilterStatus}
            isActionBtn={false}
            onView={() => {}}
            onEdit={() => {}}
            onDelete={() => {}}
            photo="cand_photo"
            filterBy={filterBy}
            // Recommended candidates get an Enroll action. The row-level guard
            // keeps the button off anyone who was not recommended, and the
            // server refuses them regardless.
            rowAction={
              canEnroll
                ? {
                    label: "Enroll",
                    isEnabled: (row: any) => row?.is_recommended === true,
                    onClick: (row: any) => setCandidateToEnroll(row.cand_id),
                  }
                : undefined
            }
          />
        )}
        {/* This tab had a button but no render branch, so it showed a blank page. */}
        {activeTab === "centerDomainChange" && <CenterDomainChange />}
        {activeTab === "interviewPanel" && <InterviewPortal />}

        <EnrollCandidateDialog
          candId={candidateToEnroll}
          onClose={() => setCandidateToEnroll(null)}
          onEnrolled={() => fetchCandidateProfile()}
        />
      </main>
    </div>
  );
}

export default AdmissionPortal;
