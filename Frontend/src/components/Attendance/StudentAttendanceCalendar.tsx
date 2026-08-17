import React from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import {
  AttendanceCalendarResponse,
  getStudentAttendanceCalendar,
  getStudentsProfile,
} from "../../services/api";
import { useBatch } from "../../context/BatchContext";
import AttendanceCalendarView from "./AttendanceCalendarView";

interface StudentOption {
  std_cnic: string;
  std_rollno: string;
  user_name: string;
  center_name?: string;
  course_name?: string;
}

/**
 * Individual student attendance calendar for staff.
 *
 * Master trainers and admins can look up any student; the server limits
 * trainers to students in the centers and courses they are allocated to.
 */
const StudentAttendanceCalendar: React.FC = () => {
  const { selectedBatchId, center_id, course_id } = useBatch();

  const [students, setStudents] = React.useState<StudentOption[]>([]);
  const [query, setQuery] = React.useState("");
  const [selectedCnic, setSelectedCnic] = React.useState<string>("");
  const [data, setData] = React.useState<AttendanceCalendarResponse | null>(null);
  const [loadingList, setLoadingList] = React.useState(false);
  const [loadingCalendar, setLoadingCalendar] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!selectedBatchId || selectedBatchId < 0) return;
    let cancelled = false;

    (async () => {
      setLoadingList(true);
      try {
        const response = await getStudentsProfile(
          selectedBatchId,
          center_id || 0,
          course_id || 0
        );
        if (cancelled) return;
        const rows = (response?.data || [])
          .filter((student: any) => student.std_cnic)
          .map((student: any) => ({
            std_cnic: student.std_cnic,
            std_rollno: student.std_rollno,
            user_name: student.user_name,
            center_name: student.center_name,
            course_name: student.course_name,
          }));
        setStudents(rows);
      } catch {
        if (!cancelled) setStudents([]);
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedBatchId, center_id, course_id]);

  const filtered = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return students.slice(0, 50);
    return students
      .filter((student) =>
        [student.user_name, student.std_rollno, student.std_cnic]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(term))
      )
      .slice(0, 50);
  }, [students, query]);

  const loadCalendar = React.useCallback(
    async (cnic: string) => {
      if (!cnic) return;
      setLoadingCalendar(true);
      setError(null);
      try {
        const response = await getStudentAttendanceCalendar({
          std_cnic: cnic,
          tb_id: selectedBatchId,
        });
        setData(response);
      } catch (err) {
        setData(null);
        const message =
          err instanceof Error ? err.message : "Could not load attendance";
        setError(message);
        toast.error(message);
      } finally {
        setLoadingCalendar(false);
      }
    },
    [selectedBatchId]
  );

  return (
    <Card
      className="w-full"
      style={{
        background: "hsl(var(--background))",
        color: "hsl(var(--foreground))",
        border: "1px solid hsl(var(--border))",
      }}
    >
      <CardHeader>
        <CardTitle>Student Attendance Calendar</CardTitle>
        <p className="text-xs text-slate-500">
          Look up any student's day-by-day attendance for the selected batch.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, roll number or CNIC"
              className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#006537]"
            />
          </div>
          <Button
            onClick={() => loadCalendar(selectedCnic)}
            disabled={!selectedCnic || loadingCalendar}
            className="bg-[hsl(var(--teal))] px-5 text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]"
          >
            {loadingCalendar ? "Loading…" : "View calendar"}
          </Button>
        </div>

        <div className="max-h-56 overflow-y-auto rounded-md border border-slate-200">
          {loadingList && (
            <p className="px-3 py-4 text-center text-xs text-slate-500">
              Loading students…
            </p>
          )}

          {!loadingList && filtered.length === 0 && (
            <p className="px-3 py-4 text-center text-xs text-slate-500">
              {students.length === 0
                ? "No students found for this batch."
                : "No student matches that search."}
            </p>
          )}

          {!loadingList &&
            filtered.map((student) => {
              const active = student.std_cnic === selectedCnic;
              return (
                <button
                  key={student.std_cnic}
                  type="button"
                  onClick={() => {
                    setSelectedCnic(student.std_cnic);
                    loadCalendar(student.std_cnic);
                  }}
                  className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-slate-50 ${
                    active ? "bg-[#006537]/5 font-semibold text-[#006537]" : "text-slate-700"
                  }`}
                >
                  <span className="truncate">{student.user_name}</span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {student.std_rollno || student.std_cnic}
                  </span>
                </button>
              );
            })}
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {error}
          </div>
        )}

        {data && !error && (
          <AttendanceCalendarView data={data} showStudentHeader />
        )}

        {!data && !error && !loadingCalendar && (
          <p className="py-6 text-center text-sm text-slate-500">
            Select a student to see their attendance calendar.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default StudentAttendanceCalendar;
