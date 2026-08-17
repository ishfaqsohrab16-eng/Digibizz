import React, { useEffect, useMemo, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  subMonths,
  addMonths,
  isSameMonth,
  isWithinInterval,
  isToday,
  startOfWeek,
  addDays,
  subDays,
} from "date-fns";
import {
  getAttendanceHistory,
  getAllCourse,
  getCenter,
} from "../../services/api";
import { useBatch } from "../../context/BatchContext";
import SettingsHeader from "../Settings/SettingsHeader";
import { Button } from "../ui/button";

interface AttendanceCounts {
  P: number;
  A: number;
  L: number;
}

const AttendanceHistory: React.FC = () => {
  const [attendanceData, setAttendanceData] = useState<
    Record<string, AttendanceCounts>
  >({});
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tbStart, setTbStart] = useState<Date | null>(null);
  const [tbEnd, setTbEnd] = useState<Date | null>(null);
  const { selectedBatchId, center_id, course_id, user_id, userType } =
    useBatch();
  const [courses, setCourses] = useState<any[]>([]);
  const [centers, setCenters] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<number>(course_id || 0);
  const [selectedCenter, setSelectedCenter] = useState<number>(center_id || 0);

  const fetchAttendanceHistory = async (month: Date) => {
    setLoading(true);
    try {
      const formattedMonth = format(month, "yyyy-MM");

      if (userType === "trainer") {
        setSelectedCourse(course_id || 0);
        setSelectedCenter(center_id || 0);
      } else if (userType === "MasterTrainer") {
        setSelectedCourse(course_id);
      }

      const response = await getAttendanceHistory({
        month: formattedMonth,
        centerId: selectedCenter,
        courseId: selectedCourse,
        batchId: selectedBatchId,
        user_id,
      });

      if (response.attendanceByDate) {
        setAttendanceData(response.attendanceByDate);
      }

      if (response.centersDates?.length > 0) {
        setTbStart(new Date(response.centersDates[0].tb_start));
        setTbEnd(new Date(response.centersDates[0].tb_end));
      }

      // Cache the fetched data
      localStorage.setItem(
        `attendance_${formattedMonth}`,
        JSON.stringify(response)
      );
    } catch (error) {
      console.error("Error fetching attendance history:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceHistory(currentMonth);
  }, [selectedBatchId, center_id, course_id, user_id]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const courseData = await getAllCourse();
        setCourses(courseData || []);
        const centerData = await getCenter();
        setCenters(centerData || []);
      } catch (err) {
        setCourses([]);
        setCenters([]);
      }
    };
    fetchData();
  }, []);

  /**
   * Totals for the month on screen, derived from the data already loaded.
   *
   * The endpoint returns the whole batch range in one response, so this needs
   * no extra request - and it means the numbers always describe the month in
   * the heading rather than the entire batch.
   *
   * Same rule as everywhere else: approved leave counts as present.
   */
  const monthTotals = useMemo(() => {
    const prefix = format(currentMonth, "yyyy-MM");
    let present = 0;
    let absent = 0;
    let leave = 0;
    let classDays = 0;

    Object.entries(attendanceData).forEach(([dateKey, counts]) => {
      if (!dateKey.startsWith(prefix)) return;
      classDays += 1;
      present += counts.P || 0;
      absent += counts.A || 0;
      leave += counts.L || 0;
    });

    const marked = present + absent + leave;
    return {
      present,
      absent,
      leave,
      classDays,
      percentage: marked > 0 ? (((present + leave) / marked) * 100).toFixed(1) : "0.0",
    };
  }, [attendanceData, currentMonth]);

  const handlePreviousMonth = () => {
    if (
      tbStart &&
      !isSameMonth(currentMonth, tbStart) &&
      currentMonth > tbStart
    ) {
      setCurrentMonth((prev) => subMonths(prev, 1)); // Go to the previous month
    }
  };

  const handleNextMonth = () => {
    if (tbEnd && !isSameMonth(currentMonth, tbEnd) && currentMonth < tbEnd) {
      setCurrentMonth((prev) => addMonths(prev, 1)); // Go to the next month
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "P":
        return "bg-green-200 text-green-800"; // Marked
      case "A":
        return "bg-red-200 text-red-800"; // Missing
      case "L":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getCalendarDays = (date: Date) => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    const currentMonthDays = eachDayOfInterval({ start, end });

    // Get the first day of the month (0 = Sunday, 1 = Monday, etc.)
    const firstDayOfMonth = start.getDay();

    // Calculate days from previous month needed to fill the first week
    const previousMonthDays = Array.from(
      { length: firstDayOfMonth },
      (_, i) => {
        return subDays(start, firstDayOfMonth - i);
      }
    );

    // Calculate how many days we need from next month
    const lastDayOfMonth = end.getDay(); // 0-6
    const nextMonthDays = Array.from({ length: 6 - lastDayOfMonth }, (_, i) =>
      addDays(end, i + 1)
    );

    return [...previousMonthDays, ...currentMonthDays, ...nextMonthDays];
  };

  const isDateDisabled = (date: Date) => {
    if (!tbStart || !tbEnd) return true; // Disable if tbStart or tbEnd is not set
    return !isWithinInterval(date, { start: tbStart, end: tbEnd });
  };

  return (
    <div className="p-6 bg-white rounded-lg mt-10 shadow-md">
      <SettingsHeader
        SettingsHeader="Attendance History"
        SettingDescription="Attendance History Monthly Data"
      />

      {/* Add dropdowns for non-trainer users */}
      {userType !== "trainer" && (
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
              onClick={() => fetchAttendanceHistory(currentMonth)}
              disabled={loading || !selectedCourse || !selectedCenter}
            >
              {loading ? "Fetching..." : "Fetch"}
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <button
          onClick={handlePreviousMonth}
          className={`px-4 py-2 rounded ${
            tbStart && currentMonth > tbStart
              ? "bg-gray-200 text-gray-800 hover:bg-gray-300"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
          disabled={!tbStart || currentMonth <= tbStart}
        >
          Previous
        </button>
        <h2 className="text-xl font-semibold text-gray-800">
          Attendance History - {format(currentMonth, "MMMM yyyy")}
        </h2>
        <button
          onClick={handleNextMonth}
          className={`px-4 py-2 rounded ${
            tbEnd && currentMonth < tbEnd
              ? "bg-gray-200 text-gray-800 hover:bg-gray-300"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
          disabled={!tbEnd || currentMonth >= tbEnd}
        >
          Next
        </button>
      </div>
      {!loading && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            {
              label: "Attendance",
              value: `${monthTotals.percentage}%`,
              hint: "Present + leave",
              tone:
                Number(monthTotals.percentage) >= 90
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : Number(monthTotals.percentage) >= 75
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-rose-200 bg-rose-50 text-rose-800",
            },
            { label: "Class days", value: monthTotals.classDays, hint: "Days marked" },
            { label: "Present", value: monthTotals.present },
            { label: "Leave", value: monthTotals.leave },
            { label: "Absent", value: monthTotals.absent },
          ].map((tile) => (
            <div
              key={tile.label}
              className={`rounded-lg border p-3 ${tile.tone || "border-gray-200 bg-white text-gray-800"}`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                {tile.label}
              </p>
              <p className="mt-1 text-2xl font-bold leading-none">{tile.value}</p>
              {tile.hint && <p className="mt-1 text-[11px] text-gray-500">{tile.hint}</p>}
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-500">Loading...</div>
      ) : (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="grid grid-cols-7 gap-px bg-muted p-4">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="text-center font-semibold p-2">
                {day}
              </div>
            ))}
            {getCalendarDays(currentMonth).map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const counts = attendanceData[dateKey] || { P: 0, A: 0, L: 0 };
              const disabled = isDateDisabled(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);

              return (
                <div
                  key={day.toISOString()}
                  className={`
                    min-h-[80px] p-2 border rounded-md
                    ${!isCurrentMonth ? "opacity-50" : ""}
                    ${isToday(day) ? "border-primary" : "border-border"}
                    ${
                      disabled
                        ? "bg-gray-100 cursor-not-allowed"
                        : "cursor-pointer"
                    }
                    ${!disabled ? "bg-background hover:bg-muted" : ""}
                  `}
                >
                  <div className="flex flex-col h-full">
                    <span
                      className={`text-sm font-semibold ${
                        !isCurrentMonth ? "text-gray-300" : "text-foreground"
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                    {!disabled && isCurrentMonth && (
                      <div className="mt-1 text-xs">
                        <span className="text-green-600">P: {counts.P}</span>{" "}
                        <span className="text-red-600">A: {counts.A}</span>{" "}
                        <span className="text-yellow-600">L: {counts.L}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceHistory;
