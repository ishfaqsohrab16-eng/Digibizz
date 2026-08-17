import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  AttendanceCalendarResponse,
  getStudentAttendanceCalendar,
} from "../../services/api";
import AttendanceCalendarView from "./AttendanceCalendarView";

/**
 * Read-only attendance for the signed-in student.
 *
 * The server resolves the student from the auth token and ignores any CNIC the
 * client sends, so this page can never show another student's record.
 */
const MyAttendance: React.FC = () => {
  const [data, setData] = React.useState<AttendanceCalendarResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getStudentAttendanceCalendar();
        if (!cancelled) setData(response);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load your attendance"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
        <CardTitle>My Attendance</CardTitle>
        {data?.student?.course_name && (
          <p className="text-xs text-slate-500">
            {data.student.course_name}
            {data.student.center_name ? ` · ${data.student.center_name}` : ""}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-transparent" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {error}
          </div>
        )}

        {!loading && !error && data && <AttendanceCalendarView data={data} />}
      </CardContent>
    </Card>
  );
};

export default MyAttendance;
