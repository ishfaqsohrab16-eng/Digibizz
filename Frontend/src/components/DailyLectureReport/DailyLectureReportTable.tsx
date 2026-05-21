import { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { useBatch } from "../../context/BatchContext";
import { getDailyReport, getCenter, getAllCourse } from "../../services/api";
import SettingsHeader from "../Settings/SettingsHeader";
import Loader from "../Loader";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  startOfWeek,
  addDays,
  subMonths,
  subDays,
  set,
} from "date-fns";
import { storeFormData } from "../../utils/formStorage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
  SelectTrigger,
} from "../../components/ui/select";

interface DailyLectureReport {
  dlr_id: number;
  t_id: number;
  center_id: number;
  course_id: number;
  tb_id: number;
  dlr_date: string;
  dlr_title: string;
  dlr_topics: string;
  dlr_practical: string;
  dlr_assignment: string;
  dlr_challenges: string;
  dlr_month: string;
  t_cnic: string;
  course_name: string;
  center_name: string;
  tb_name: string;
}

const DailyLectureReportTable = ({
  openForm,
}: {
  openForm: (formName: string) => void;
}) => {
  const { selectedBatchId, user_id, userType, center_id, course_id } =
    useBatch();
  const [reports, setReports] = useState<DailyLectureReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportPercentage, setReportPercentage] = useState<number>(0);
  const [totalDays, setTotalDays] = useState<number>(0);
  const [submittedDays, setSubmittedDays] = useState<number>(0);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] =
    useState<DailyLectureReport | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [courses, setCourses] = useState<any[]>([]);
  const [centers, setCenters] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<number>(course_id || 0);
  const [selectedCenter, setSelectedCenter] = useState<number>(center_id || 0);
  const [centerBatchStartDate, setCenterBatchStartDate] = useState<Date | null>(
    null
  );
  const [centerBatchEndDate, setCenterBatchEndDate] = useState<Date | null>(
    null
  );
  const [missingReportDates, setMissingReportDates] = useState<string[]>([]);
  const [submittedReportDates, setSubmittedReportDates] = useState<string[]>([]);
  const [holidayDates, setHolidayDates] = useState<string[]>([]); // <-- Add state for holidays
  useEffect(() => {
    fetchReports();
  }, [selectedBatchId, user_id]);
  const fetchReports = async () => {
    try {
      // 1. Determine the actual IDs directly without relying on delayed React state
      let actualCourseId = selectedCourse;
      let actualCenterId = selectedCenter;

      if (userType === "trainer") {
        actualCourseId = course_id || 0;
        actualCenterId = center_id || 0;
        setSelectedCourse(actualCourseId);
        setSelectedCenter(actualCenterId);
      } else if (userType === "MasterTrainer") {
        actualCourseId = course_id || 0;
        setSelectedCourse(actualCourseId);
        // MT uses selectedCenter from dropdown, so actualCenterId remains selectedCenter
      }

      // 2. STOP Admins and Master Trainers from fetching if they haven't selected a required dropdown yet
      if (userType === "SuperAdmin" || userType === "Admin" || userType === "Center Manager") {
        if (!actualCourseId || !actualCenterId) {
          // Abort the fetch entirely. Wait for them to select options and click "Fetch"
          setLoading(false);
          return; 
        }
      } else if (userType === "MasterTrainer") {
        if (!actualCenterId) {
          // Abort until MT selects a center
          setLoading(false);
          return;
        }
      }

      setLoading(true);
      setReports([]);

      // 3. Call the API using our actual validated variables, NOT the delayed state variables
      const response = await getDailyReport(
        selectedBatchId,
        user_id,
        userType,
        actualCenterId,
        actualCourseId
      );

      // Set calendar range if present in response
      if (response.centerBatchStartDate && response.centerBatchEndDate) {
        setCenterBatchStartDate(new Date(response.centerBatchStartDate));
        setCenterBatchEndDate(new Date(response.centerBatchEndDate));
      } else {
        setCenterBatchStartDate(null);
        setCenterBatchEndDate(null);
      }

      // If backend returns reportPercentage, totalDays, submittedDays
      if (
        typeof response.reportPercentage === "number" &&
        typeof response.totalDays === "number" &&
        typeof response.submittedDays === "number"
      ) {
        setReportPercentage(response.reportPercentage);
        setTotalDays(response.totalDays);
        setSubmittedDays(response.submittedDays);
      } else {
        setReportPercentage(0);
        setTotalDays(0);
        setSubmittedDays(0);
      }

      const formattedReports = Array.isArray(response.reports)
        ? response.reports.map((report: any) => ({
            dlr_id: report.dlr_id || 0,
            t_id: report.t_id || 0,
            center_id: report.center_id || 0,
            course_id: report.course_id || 0,
            tb_id: report.tb_id || 0,
            dlr_date: report.dlr_date || "",
            dlr_title: report.dlr_title || "",
            dlr_topics: report.dlr_topics || "",
            dlr_practical: report.dlr_practical || "",
            dlr_assignment: report.dlr_assignment || "",
            dlr_challenges: report.dlr_challenges || "",
            dlr_month: report.dlr_month || "",
            t_cnic: report.trainers?.user.user_name || "",
            course_name: report.courses?.course_name || "",
            center_name: report.centers?.center_name || "",
            tb_name: report.training_batches?.tb_name || "",
          }))
        : [];

      setReports(formattedReports);
      
      // Set missing/submitted report dates if present in response
      setMissingReportDates(response.missingReportDates || []);
      setSubmittedReportDates(response.submittedReportDates || []);
      setHolidayDates(response.holidayDates || []); 
      
    } catch (error) {
      console.error("Error fetching reports:", error);
      setReports([]); 
    } finally {
      setLoading(false);
    }
  };

  const getReportForDate = (date: Date) => {
    return reports.find(
      (report) => report.dlr_date === format(date, "yyyy-MM-dd")
    );
  };

  const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;

  const isWorkingDay = (date: Date) => {
    return !isWeekend(date);
  };

  const isReportSubmitted = (date: Date) => {
    if (!isWorkingDay(date)) return false;
    return reports.some(
      (report) => report.dlr_date === format(date, "yyyy-MM-dd")
    );
  };

  const handleDateClick = (date: Date) => {
    if (!isWorkingDay(date)) {
      return; // Don't do anything if it's not a working day
    }
    const report = getReportForDate(date);
    if (report) {
      setSelectedReport(report);
      setSelectedDate(date);
      setIsDialogOpen(true);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    return eachDayOfInterval({ start, end });
  };

  // Helper to check if a month is before/after the allowed range
  const isPrevMonthDisabled = () => {
    if (!centerBatchStartDate) return false;
    const prevMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() - 1,
      1
    );
    return (
      prevMonth <
      new Date(
        centerBatchStartDate.getFullYear(),
        centerBatchStartDate.getMonth(),
        1
      )
    );
  };

  const isNextMonthDisabled = () => {
    if (!centerBatchEndDate) return false;
    const nextMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      1
    );
    return (
      nextMonth >
      new Date(
        centerBatchEndDate.getFullYear(),
        centerBatchEndDate.getMonth(),
        1
      )
    );
  };

  const nextMonth = () => {
    if (!isNextMonthDisabled()) {
      setCurrentMonth(
        new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
      );
    }
  };

  const previousMonth = () => {
    if (!isPrevMonthDisabled()) {
      setCurrentMonth(
        new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
      );
    }
  };

  const modifiers = {
    submitted: reports.map((report) => new Date(report.dlr_date)),
  };

  const modifiersStyles = {
    submitted: {
      backgroundColor: "rgb(34 197 94)",
      color: "white",
    },
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const courseData = await getAllCourse();
        setCourses(courseData || []);
        const centerData = await getCenter();
        setCenters(centerData || []);
        setLoading(false);
      } catch (err) {
        setCourses([]);
        setCenters([]);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader />
        <div className="text-gray-500">Loading reports...</div>
      </div>
    );
  }

  // Only show calendar if reports have been fetched at least once
  const shouldShowCalendar =
    reports.length > 0 ||
    (centerBatchStartDate !== null && centerBatchEndDate !== null) ||
    totalDays > 0;

  const handlecreate = (recording: any) => {
    storeFormData("dailylecturecreat", recording);
    openForm("DailyLectureReportForm");
  };
  // Helper to clamp a date between start and end
  const clampDate = (date: Date, min: Date, max: Date) => {
    if (date < min) return min;
    if (date > max) return max;
    return date;
  };

  // Calendar days generator, now limited to batch start/end
  const getCalendarDays = (date: Date) => {
    if (!centerBatchStartDate || !centerBatchEndDate) {
      // fallback to full month if no range
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      const currentMonthDays = eachDayOfInterval({ start, end });
      const startDay = startOfWeek(start);
      const preDays = eachDayOfInterval({
        start: startDay,
        end: subDays(start, 1),
      });
      const totalDaysNeeded = 42;
      const remainingDays =
        totalDaysNeeded - (preDays.length + currentMonthDays.length);
      const postDays = eachDayOfInterval({
        start: addDays(end, 1),
        end: addDays(end, remainingDays),
      });
      return [...preDays, ...currentMonthDays, ...postDays];
    }

    // Clamp the calendar to the batch range
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    const start = clampDate(
      monthStart,
      centerBatchStartDate,
      centerBatchEndDate
    );
    const end = clampDate(monthEnd, centerBatchStartDate, centerBatchEndDate);

    // Only show days within the batch range
    const currentMonthDays = eachDayOfInterval({ start, end });

    // Optionally, you can pad the calendar to always show 6 weeks
    const startDay = startOfWeek(start);
    const preDays =
      start > startDay
        ? eachDayOfInterval({ start: startDay, end: subDays(start, 1) })
        : [];
    const totalDaysNeeded = 42;
    const remainingDays =
      totalDaysNeeded - (preDays.length + currentMonthDays.length);
    const postDays =
      remainingDays > 0
        ? eachDayOfInterval({
            start: addDays(end, 1),
            end: addDays(end, remainingDays),
          })
        : [];

    return [...preDays, ...currentMonthDays, ...postDays];
  };

  // Helper functions to check if a date is in submitted/missing/holiday report dates
  const isSubmittedReportDate = (date: Date) => {
    return submittedReportDates.includes(format(date, "yyyy-MM-dd"));
  };

  const isMissingReportDate = (date: Date) => {
    return missingReportDates.includes(format(date, "yyyy-MM-dd"));
  };

  const isHolidayDate = (date: Date) => {
    return holidayDates.includes(format(date, "yyyy-MM-dd"));
  };

  return (
    <div className="w-full overflow-x-auto">
      <SettingsHeader
        SettingsHeader="Daily Lecture Report"
        SettingDescription="Please provide report on daily basis to keep your progress up to the mark!"
      />
      {/* Dropdowns for Course and Center */}
      {userType !== "trainer" && (
        <>
          <div className="flex gap-4 mx-10 mb-4">
            {userType !== "MasterTrainer" && (
              <div className="flex flex-col flex-1">
                <label className="mb-1 text-sm font-medium">Course</label>
                <select
                  className="flex-1 px-4 py-2 border rounded-md shadow-sm focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))]"
                  style={{
                    background: "hsl(var(--background))",
                    color: "hsl(var(--foreground))",
                    borderColor: "hsl(var(--border))",
                  }}
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(Number(e.target.value))}
                >
                  <option value="">All Courses</option>
                  {courses.map((course) => (
                    <option key={course.course_id} value={course.course_id}>
                      {course.course_full_name || course.course_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col flex-1">
              <label className="mb-1 text-sm font-medium">Center</label>
              <select
                className="flex-1 px-4 py-2 border rounded-md shadow-sm focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))]"
                style={{
                  background: "hsl(var(--background))",
                  color: "hsl(var(--foreground))",
                  borderColor: "hsl(var(--border))",
                }}
                value={selectedCenter}
                onChange={(e) => setSelectedCenter(Number(e.target.value))}
              >
                <option value="">All Centers</option>
                {centers.map((center) => (
                  <option key={center.center_id} value={center.center_id}>
                    {center.center_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col justify-end">
              <Button
                className="h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md shadow-sm"
                onClick={fetchReports}
                disabled={loading || (userType !== "MasterTrainer" && (!selectedCourse || !selectedCenter)) || (userType === "MasterTrainer" && !selectedCenter)}
              >
                {loading ? "Fetching..." : "Fetch"}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Table Header */}
      {/* Progress Bar */}
      { totalDays > 0 && (
        <div className="mx-10 mb-6">
          <div className="flex justify-between items-center mb-1">
            <span
              className="text-sm font-medium"
              style={{ color: "hsl(var(--primary))" }}
            >
              Report Submission Progress
            </span>
            <span
              className="text-xs"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              {submittedDays} / {totalDays} days ({reportPercentage}%)
            </span>
          </div>
          <div
            className="w-full rounded-full h-4 overflow-hidden"
            style={{
              background: "hsl(var(--muted))",
              border: "1px solid hsl(var(--border))",
            }}
          >
            <div
              className="h-4 rounded-full transition-all duration-700"
              style={{
                background: "hsl(var(--primary))",
                width: `${reportPercentage}%`,
                minWidth: reportPercentage > 0 ? "1.5rem" : "0",
                color: "hsl(var(--primary-foreground))",
                boxShadow: "0 1px 4px 0 hsl(var(--primary) / 0.15)",
              }}
            ></div>
          </div>
        </div>
      )}
      {(userType === "trainer" || userType === "SuperAdmin") && (
        <div className="flex justify-between ml-10 items-center mb-6">
          <Button
            onClick={() => handlecreate(reports)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg shadow-md transform transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            Add Report
          </Button>
        </div>
      )}
      {shouldShowCalendar && (
        <div className="px-10 mb-6">
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            {/* Calendar Header */}
            <div className="flex items-center justify-between p-4">
              <h2 className="font-semibold text-xl">
                {format(currentMonth, "MMMM yyyy")}
              </h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={previousMonth}
                  disabled={isPrevMonthDisabled()}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={nextMonth}
                  disabled={isNextMonthDisabled()}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-px bg-muted p-4">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center font-semibold p-2">
                  {day}
                </div>
              ))}
              {getCalendarDays(currentMonth).map((date, idx) => {
                const isSubmitted = isSubmittedReportDate(date);
                const isMissing = isMissingReportDate(date);
                const isHoliday = isHolidayDate(date);
                const isWeekendDate = isWeekend(date);
                const isSundayDate = date.getDay() === 0;
                const isSaturdayDate = date.getDay() === 6;
                const isCurrentMonth = isSameMonth(date, currentMonth);

                return (
                  <div
                    key={date.toString()}
                    className={`
                    min-h-[80px] p-2 border rounded-md
                    ${!isCurrentMonth ? "opacity-50" : ""}
                    ${isToday(date) ? "border-primary" : "border-border"}
                    ${
                      isWeekendDate
                        ? "bg-gray-100 cursor-not-allowed"
                        : isHoliday && isCurrentMonth
                        ? "bg-yellow-100 text-yellow-700 cursor-not-allowed"
                        : "cursor-pointer"
                    }
                    ${
                      isSubmitted && isCurrentMonth
                        ? "bg-emerald-100 hover:bg-emerald-200"
                        : isMissing && isCurrentMonth
                        ? "bg-pink-100 hover:bg-pink-200"
                        : isHoliday && isCurrentMonth
                        ? "bg-yellow-100"
                        : "bg-background hover:bg-muted"
                    }
                  `}
                    onClick={() =>
                      isCurrentMonth &&
                      !isHoliday &&
                      !isWeekendDate &&
                      handleDateClick(date)
                    }
                  >
                    <div className="flex flex-col h-full">
                      <span
                        className={`
                        text-sm font-semibold
                        ${!isCurrentMonth ? "text-gray-300" : ""}
                        ${isWeekendDate ? "text-gray-400" : ""}
                        ${
                          isSubmitted && isCurrentMonth
                            ? "text-emerald-700"
                            : isMissing && isCurrentMonth
                            ? "text-pink-700"
                            : isHoliday && isCurrentMonth
                            ? "text-yellow-700"
                            : "text-foreground"
                        }
                      `}
                      >
                        {format(date, "d")}
                      </span>
                      {isCurrentMonth &&
                        (isHoliday ? (
                          <div className="mt-1 text-xs text-yellow-700">
                            Holiday
                          </div>
                        ) : isWeekendDate ? (
                          <div className="mt-1 text-xs text-gray-400">
                            {isSundayDate ? "Sunday" : "Saturday"}
                          </div>
                        ) : isSubmitted ? (
                          <div className="mt-1 text-xs text-emerald-600">
                            Report Submitted
                          </div>
                        ) : isMissing ? (
                          <div className="mt-1 text-xs text-pink-600">
                            Missing Report
                          </div>
                        ) : null)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              Report for {selectedDate ? format(selectedDate, "PPP") : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {selectedReport && (
              <>
                <div>
                  <h4 className="font-semibold">Title</h4>
                  <p>{selectedReport.dlr_title}</p>
                </div>
                <div>
                  <h4 className="font-semibold">Topics</h4>
                  <p>{selectedReport.dlr_topics}</p>
                </div>
                <div>
                  <h4 className="font-semibold">Practical</h4>
                  <p>{selectedReport.dlr_practical}</p>
                </div>
                <div>
                  <h4 className="font-semibold">Assignment</h4>
                  <p>{selectedReport.dlr_assignment}</p>
                </div>
                <div>
                  <h4 className="font-semibold">Challenges</h4>
                  <p>{selectedReport.dlr_challenges}</p>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DailyLectureReportTable;
