import React, { useEffect, useState } from "react";
import {
  Users,
  UserCheck,
  UserX,
  ClipboardList,
  Ban,
  UserPlus,
  ChevronDown,
  Upload,
  CalendarDays,
  Clock3,
} from "lucide-react";
import {
  getCandidateProfile,
  getSelectedCandidateProfile,
  getCenter,
  getAllCourse,
  getClassSchedules,
  saveClassSchedule,
  deleteClassSchedule,
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
import BulkEnrollDialog from "./BulkEnrollDialog";
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

type ScheduleFormState = {
  cs_start_date: string;
  cs_class_days: string;
  cs_start_time: string;
  cs_end_time: string;
  cs_note: string;
};

function ClassScheduleManager({ tbId }: { tbId: number }) {
  const [centers, setCenters] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [selectedCenterId, setSelectedCenterId] = useState<string>("");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [form, setForm] = useState<ScheduleFormState>({
    cs_start_date: "",
    cs_class_days: "",
    cs_start_time: "",
    cs_end_time: "",
    cs_note: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [centersRes, coursesRes, schedulesRes] = await Promise.all([
        getCenter(),
        getAllCourse(),
        getClassSchedules(tbId),
      ]);

      const list = Array.isArray(centersRes?.data) ? centersRes.data : centersRes || [];
      const courseList = Array.isArray(coursesRes?.data)
        ? coursesRes.data
        : Array.isArray(coursesRes)
        ? coursesRes
        : [];
      const scheduleList = schedulesRes?.classes || [];

      setCenters(list);
      setCourses(courseList);
      setRows(scheduleList);

      if (!selectedCenterId && list.length) {
        setSelectedCenterId(String(list[0].center_id));
      }
      if (!selectedCourseId && courseList.length) {
        setSelectedCourseId(String(courseList[0].course_id));
      }
    } catch (err: any) {
      setError(err.message || "Failed to load class schedules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tbId) {
      loadData();
    }
  }, [tbId]);

  const selectedSchedule = rows.find(
    (row) =>
      String(row.center_id) === String(selectedCenterId) &&
      String(row.course_id) === String(selectedCourseId)
  );

  const handleSave = async () => {
    if (!selectedCenterId || !selectedCourseId) {
      setError("Select both a centre and a course");
      return;
    }

    if (!form.cs_start_date || !form.cs_class_days || !form.cs_start_time || !form.cs_end_time) {
      setError("Please fill in start date, class days, and class timings");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await saveClassSchedule({
        center_id: Number(selectedCenterId),
        course_id: Number(selectedCourseId),
        tb_id: tbId,
        cs_start_date: form.cs_start_date,
        cs_class_days: form.cs_class_days,
        cs_start_time: form.cs_start_time,
        cs_end_time: form.cs_end_time,
        cs_note: form.cs_note.trim(),
      });

      setForm({
        cs_start_date: "",
        cs_class_days: "",
        cs_start_time: "",
        cs_end_time: "",
        cs_note: "",
      });
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to save schedule");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (csId: number) => {
    try {
      setError(null);
      await deleteClassSchedule(csId);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to delete schedule");
    }
  };

  return (
    <div className="container mx-auto px-4 sm:px-8 py-6 sm:py-8">
      <div className="mb-6 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <CalendarDays className="h-5 w-5 text-[hsl(var(--primary))]" />
          <h2 className="text-xl font-semibold text-[hsl(var(--foreground))]">Class Schedule</h2>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-[hsl(var(--muted-foreground))]">Loading schedules...</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr,1fr]">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-[hsl(var(--muted-foreground))]">
                  Centre
                  <select
                    value={selectedCenterId}
                    onChange={(e) => setSelectedCenterId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-[hsl(var(--foreground))]"
                  >
                    {centers.map((center) => (
                      <option key={center.center_id} value={center.center_id}>
                        {center.center_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm text-[hsl(var(--muted-foreground))]">
                  Course
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-[hsl(var(--foreground))]"
                  >
                    {courses.map((course) => (
                      <option key={course.course_id} value={course.course_id}>
                        {course.course_full_name || course.course_name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-[hsl(var(--muted-foreground))]">
                  Start date
                  <input
                    type="date"
                    value={form.cs_start_date}
                    onChange={(e) => setForm({ ...form, cs_start_date: e.target.value })}
                    className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-[hsl(var(--foreground))]"
                  />
                </label>
                <label className="text-sm text-[hsl(var(--muted-foreground))]">
                  Class days
                  <input
                    value={form.cs_class_days}
                    onChange={(e) => setForm({ ...form, cs_class_days: e.target.value })}
                    placeholder="Monday to Friday"
                    className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-[hsl(var(--foreground))]"
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-[hsl(var(--muted-foreground))]">
                  Start time
                  <input
                    value={form.cs_start_time}
                    onChange={(e) => setForm({ ...form, cs_start_time: e.target.value })}
                    placeholder="09:00 AM"
                    className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-[hsl(var(--foreground))]"
                  />
                </label>
                <label className="text-sm text-[hsl(var(--muted-foreground))]">
                  End time
                  <input
                    value={form.cs_end_time}
                    onChange={(e) => setForm({ ...form, cs_end_time: e.target.value })}
                    placeholder="01:00 PM"
                    className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-[hsl(var(--foreground))]"
                  />
                </label>
              </div>

              <label className="block text-sm text-[hsl(var(--muted-foreground))]">
                Note (optional)
                <textarea
                  value={form.cs_note}
                  onChange={(e) => setForm({ ...form, cs_note: e.target.value })}
                  placeholder="Room 4, Gate B, etc."
                  rows={3}
                  className="mt-1 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-[hsl(var(--foreground))]"
                />
              </label>

              <div className="flex justify-end">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving..." : selectedSchedule?.schedule ? "Update schedule" : "Save schedule"}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--foreground))]">
                <Clock3 className="h-4 w-4 text-[hsl(var(--primary))]" />
                Batch classes
              </div>

              {rows.length === 0 ? (
                <div className="rounded-md border border-dashed border-[hsl(var(--border))] p-4 text-sm text-[hsl(var(--muted-foreground))]">
                  No class schedules entered for this batch yet.
                </div>
              ) : (
                rows.map((row) => (
                  <div
                    key={`${row.center_id}-${row.course_id}`}
                    className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[hsl(var(--foreground))]">{row.center_name}</p>
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">{row.course_name}</p>
                      </div>
                      {row.schedule && (
                        <button
                          onClick={() => handleDelete(row.schedule.cs_id)}
                          className="text-xs font-medium text-red-600 hover:text-red-700"
                        >
                          Delete
                        </button>
                      )}
                    </div>

                    {row.schedule ? (
                      <div className="space-y-1 text-sm text-[hsl(var(--muted-foreground))]">
                        <p><span className="font-medium text-[hsl(var(--foreground))]">Start:</span> {row.schedule.cs_start_date}</p>
                        <p><span className="font-medium text-[hsl(var(--foreground))]">Days:</span> {row.schedule.cs_class_days}</p>
                        <p><span className="font-medium text-[hsl(var(--foreground))]">Timings:</span> {row.schedule.cs_start_time} - {row.schedule.cs_end_time}</p>
                        {row.schedule.cs_note && <p><span className="font-medium text-[hsl(var(--foreground))]">Note:</span> {row.schedule.cs_note}</p>}
                      </div>
                    ) : (
                      <p className="text-sm text-amber-700">Missing schedule</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
  const [bulkEnrollOpen, setBulkEnrollOpen] = useState(false);

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
            // Tri-state: NULL means the interviewer was never asked, which is
            // not the same answer as "No". Written to its own display key so
            // the raw flag survives for anything that needs the real value.
            uob_student:
              candidate.is_uob_student === null ||
              candidate.is_uob_student === undefined
                ? "Not asked"
                : Number(candidate.is_uob_student) === 1
                ? "Yes"
                : "No",
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
            <button
              onClick={() => setActiveTab("classSchedule")}
              className="px-3 py-2 rounded-md text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
            >
              Class Schedule
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
          <>
            {/* An interview panel finishes with a list of CNICs, not with
                somebody sitting at this table clicking Enroll two hundred
                times. The button sits above the list it acts on. */}
            {canEnroll && (
              <div className="mb-3 flex justify-end">
                <button
                  onClick={() => setBulkEnrollOpen(true)}
                  disabled={!selectedBatchId}
                  title={
                    selectedBatchId
                      ? undefined
                      : "Select a training batch first"
                  }
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Upload className="h-4 w-4" /> Enrol from CNIC list
                </button>
              </div>
            )}
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
          </>
        )}
        {/* This tab had a button but no render branch, so it showed a blank page. */}
        {activeTab === "centerDomainChange" && <CenterDomainChange />}
        {activeTab === "classSchedule" && <ClassScheduleManager tbId={selectedBatchId} />}
        {activeTab === "interviewPanel" && <InterviewPortal />}

        <EnrollCandidateDialog
          candId={candidateToEnroll}
          onClose={() => setCandidateToEnroll(null)}
          onEnrolled={() => fetchCandidateProfile()}
        />

        <BulkEnrollDialog
          open={bulkEnrollOpen}
          tbId={selectedBatchId}
          batchName={selectedBatchName}
          onClose={() => setBulkEnrollOpen(false)}
          onEnrolled={() => fetchCandidateProfile()}
        />
      </main>
    </div>
  );
}

export default AdmissionPortal;
