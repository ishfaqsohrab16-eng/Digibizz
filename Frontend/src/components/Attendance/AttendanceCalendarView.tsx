import React from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { AttendanceCalendarResponse } from "../../services/api";

type Status = "P" | "A" | "L" | null;

const STATUS_STYLES: Record<
  "P" | "A" | "L" | "unmarked" | "none",
  { cell: string; dot: string; label: string }
> = {
  P: {
    cell: "bg-emerald-50 border-emerald-200 text-emerald-900",
    dot: "bg-emerald-500",
    label: "Present",
  },
  L: {
    cell: "bg-amber-50 border-amber-200 text-amber-900",
    dot: "bg-amber-500",
    label: "Leave",
  },
  A: {
    cell: "bg-rose-50 border-rose-200 text-rose-900",
    dot: "bg-rose-500",
    label: "Absent",
  },
  unmarked: {
    cell: "bg-slate-100 border-dashed border-slate-300 text-slate-500",
    dot: "bg-slate-400",
    label: "Not marked",
  },
  none: {
    cell: "bg-transparent border-transparent text-slate-300",
    dot: "",
    label: "",
  },
};

const percentageTone = (value: number) => {
  if (value >= 90) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (value >= 75) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-rose-700 bg-rose-50 border-rose-200";
};

interface Props {
  data: AttendanceCalendarResponse;
  /** Heading shown above the summary tiles. */
  title?: string;
  /** Shown when staff are viewing someone else's record. */
  showStudentHeader?: boolean;
}

const StatTile: React.FC<{ label: string; value: React.ReactNode; hint?: string; tone?: string }> = ({
  label,
  value,
  hint,
  tone,
}) => (
  <div className={`rounded-lg border p-3 ${tone || "border-slate-200 bg-white"}`}>
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-bold leading-none">{value}</p>
    {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
  </div>
);

const AttendanceCalendarView: React.FC<Props> = ({ data, title, showStudentHeader }) => {
  const statusByDate = React.useMemo(() => {
    const map = new Map<string, Status>();
    data.days.forEach((day) => map.set(day.date, day.status));
    return map;
  }, [data.days]);

  // Start on the month of the most recent class day so the view opens on
  // something useful rather than an empty current month.
  const lastDay = data.days.length ? data.days[data.days.length - 1].date : null;
  const [month, setMonth] = React.useState<Date>(
    lastDay ? startOfMonth(parseISO(lastDay)) : startOfMonth(new Date())
  );

  const firstDate = data.firstMarkedDate ? parseISO(data.firstMarkedDate) : null;
  const canGoBack = firstDate ? startOfMonth(firstDate) < startOfMonth(month) : false;
  const canGoForward = lastDay ? startOfMonth(parseISO(lastDay)) > startOfMonth(month) : false;

  const gridDays = React.useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const days = eachDayOfInterval({ start, end });
    // Pad so the 1st lands under the correct weekday column (Sun-first).
    const leading = Array.from({ length: start.getDay() }, () => null);
    return [...leading, ...days];
  }, [month]);

  const monthCounts = React.useMemo(() => {
    let present = 0;
    let absent = 0;
    let leave = 0;
    let unmarked = 0;
    data.days.forEach((day) => {
      if (!isSameMonth(parseISO(day.date), month)) return;
      if (day.status === "P") present += 1;
      else if (day.status === "A") absent += 1;
      else if (day.status === "L") leave += 1;
      else unmarked += 1;
    });
    return { present, absent, leave, unmarked };
  }, [data.days, month]);

  if (!data.firstMarkedDate) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm font-medium text-slate-700">No attendance recorded yet</p>
        <p className="mt-1 text-xs text-slate-500">
          The percentage starts counting from the first day attendance is marked for this class.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showStudentHeader && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm font-semibold text-slate-800">
            {data.student.std_rollno || data.student.std_cnic}
          </p>
          <p className="text-xs text-slate-600">
            {data.student.course_name}
            {data.student.center_name ? ` · ${data.student.center_name}` : ""}
          </p>
        </div>
      )}

      {title && <h3 className="text-sm font-semibold text-slate-800">{title}</h3>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile
          label="Attendance"
          value={`${data.percentage}%`}
          hint={`${data.present + data.leave} of ${data.daysCounted} days`}
          tone={percentageTone(data.percentage)}
        />
        <StatTile label="Present" value={data.present} />
        <StatTile label="Leave" value={data.leave} hint="Counts as present" />
        <StatTile label="Absent" value={data.absent} />
        <StatTile
          label="Counted from"
          value={format(parseISO(data.firstMarkedDate), "d MMM")}
          hint="First marked day"
        />
      </div>

      {data.unmarkedDays > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <p className="text-xs text-amber-900">
            <strong>{data.unmarkedDays}</strong>{" "}
            {data.unmarkedDays === 1 ? "day was" : "days were"} not marked for this student even
            though the class was held. These are excluded from the percentage rather than counted
            as absent.
          </p>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonth((prev) => subMonths(prev, 1))}
            disabled={!canGoBack}
            aria-label="Previous month"
            className="rounded-md border border-slate-200 p-1.5 text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-slate-50"
          >
            <ChevronLeft size={16} />
          </button>
          <p className="text-sm font-semibold text-slate-800">{format(month, "MMMM yyyy")}</p>
          <button
            type="button"
            onClick={() => setMonth((prev) => addMonths(prev, 1))}
            disabled={!canGoForward}
            aria-label="Next month"
            className="rounded-md border border-slate-200 p-1.5 text-slate-600 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-slate-50"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="pb-1 text-[11px] font-semibold uppercase text-slate-400">
              {day.slice(0, 1)}
              <span className="hidden sm:inline">{day.slice(1)}</span>
            </div>
          ))}

          {gridDays.map((day, index) => {
            if (!day) return <div key={`pad-${index}`} />;

            const key = format(day, "yyyy-MM-dd");
            const hasEntry = statusByDate.has(key);
            const status = statusByDate.get(key) ?? null;
            const styleKey = !hasEntry ? "none" : status === null ? "unmarked" : status;
            const style = STATUS_STYLES[styleKey];

            return (
              <div
                key={key}
                title={hasEntry ? `${format(day, "d MMM yyyy")} — ${style.label}` : undefined}
                className={`flex aspect-square flex-col items-center justify-center rounded-md border text-xs font-medium ${style.cell}`}
              >
                <span>{format(day, "d")}</span>
                {hasEntry && (
                  <span className="mt-0.5 text-[10px] font-bold">
                    {status === null ? "–" : status}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-[11px] text-slate-600">
          {(["P", "L", "A", "unmarked"] as const).map((key) => (
            <span key={key} className="inline-flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${STATUS_STYLES[key].dot}`} />
              {STATUS_STYLES[key].label}
            </span>
          ))}
          <span className="ml-auto">
            This month: {monthCounts.present}P · {monthCounts.leave}L · {monthCounts.absent}A
            {monthCounts.unmarked > 0 ? ` · ${monthCounts.unmarked} unmarked` : ""}
          </span>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-500">
        Counting starts on the first day attendance was marked for this student in this class
        ({format(parseISO(data.firstMarkedDate), "d MMM yyyy")}). Approved leave counts as present.
        Days the class was held but the student was never marked are excluded.
      </p>
    </div>
  );
};

export default AttendanceCalendarView;
