import React, { useEffect, useState } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
import { AttendanceCalendarResponse, getStudentAttendanceCalendar } from "../../services/api";
import AttendanceCalendarView from "../Attendance/AttendanceCalendarView";

/**
 * A student's attendance, day by day, on their profile - for admins.
 *
 * The same endpoint and the same calendar as the student's own "My
 * Attendance", with the student named by CNIC instead of taken from the
 * token. Reusing them means an admin and the student are looking at exactly
 * the same record, coloured the same way, rather than two calendars that
 * could disagree about what "leave" means.
 *
 * The server decides who may read this (attendance viewers only); the profile
 * only decides where to show it. It loads when the profile is opened rather
 * than with the student list, so a list of four hundred trainees does not
 * fetch four hundred calendars.
 */
const StudentAttendanceCard: React.FC<{ stdCnic: string }> = ({ stdCnic }) => {
  const [data, setData] = useState<AttendanceCalendarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!stdCnic) {
      setLoading(false);
      setError("This student has no CNIC on record, so their attendance cannot be looked up.");
      return;
    }

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getStudentAttendanceCalendar({ std_cnic: stdCnic });
        if (!cancelled) setData(response);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not load this student's attendance.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [stdCnic]);

  return (
    <div className="mt-8 overflow-hidden rounded-lg bg-[hsl(var(--card))] shadow-sm transition-shadow hover:shadow-md">
      <div className="bg-[hsl(var(--card))] px-6 py-4">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-[hsl(var(--foreground))]">
          <CalendarDays className="h-5 w-5" />
          Attendance
        </h3>
        <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
          Every class day, as marked in the register — present, absent or on leave.
        </p>
      </div>

      <div className="px-6 pb-6">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--primary))]" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            {error}
          </div>
        )}

        {!loading && !error && data && <AttendanceCalendarView data={data} />}
      </div>
    </div>
  );
};

export default StudentAttendanceCard;
