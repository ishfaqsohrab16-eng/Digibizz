import React from "react";
import { EvalWeek, OnlineCourseAttendance } from "../../services/api";
import { reportDays, shortDate } from "../print/PrintDocument";

/**
 * One row per course, one column per teaching day: how many students were
 * marked present.
 *
 * Read-only on every screen. These are counted from the register, and a
 * figure somebody can type over is a figure that can disagree with the
 * register - which is exactly what the M&E module decided not to allow.
 *
 * Absent and leave sit under the present count in small type: the paper form
 * only had room for one number, but a screen does, and "19 present" means
 * something different next to "1 absent" than next to "12 absent".
 */
interface Props {
  attendance: OnlineCourseAttendance[];
  weekStart: string;
  week?: EvalWeek | null;
}

const OnlineAttendanceTable: React.FC<Props> = ({ attendance, weekStart, week }) => {
  const days = reportDays(weekStart, week?.days);

  if (attendance.length === 0) {
    return (
      <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
        No courses are allocated at this centre in this batch.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="bg-slate-100 px-3 py-2 text-left text-xs font-semibold text-slate-700">
              Course
            </th>
            {days.map((day) => (
              <th
                key={day.key}
                className="bg-slate-100 px-2 py-2 text-center text-xs font-semibold text-slate-700"
              >
                {day.label}
                <span className="block text-[10px] font-normal text-slate-500">
                  {shortDate(day.date)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {attendance.map((course) => (
            <tr key={course.course_id}>
              <td className="border-b border-slate-100 px-3 py-2 text-sm font-medium text-slate-800">
                {course.course_name}
              </td>
              {days.map((day) => {
                const cell = course.days?.[day.key];
                return (
                  <td key={day.key} className="border-b border-slate-100 px-2 py-2 text-center">
                    {cell?.marked ? (
                      <>
                        <span className="text-base font-bold tabular-nums text-slate-900">
                          {cell.P}
                        </span>
                        <span className="block text-[10px] tabular-nums text-slate-400">
                          A {cell.A} · L {cell.L}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-300" title="No register was marked that day">
                        —
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default OnlineAttendanceTable;
