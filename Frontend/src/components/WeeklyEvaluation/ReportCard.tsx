import React from "react";
import { BadgeCheck, Check, X } from "lucide-react";
import { EvalCriterion, EvalReport, EvalWeek } from "../../services/api";

/**
 * A submitted report, read back.
 *
 * Same two tables as the form, without the inputs. Kept as its own component
 * because the history list and the admin view both need it, and a read-only
 * mode bolted into the form would mean every future change to the form is a
 * change to two behaviours at once.
 *
 * Where the Master Trainer's figure differs from what the LMS counted, both
 * are shown. That difference is the most interesting thing on the page - it is
 * the MT saying the system is wrong about their centre - and it exists only
 * because the computed figures are snapshotted with the report.
 */

const DAY_ORDER: Array<{ key: string; label: string }> = [
  { key: "fri", label: "Fri" },
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thurs" },
];

const Mark: React.FC<{ on: boolean }> = ({ on }) => (
  <span
    className={`inline-flex h-6 w-6 items-center justify-center rounded-md ${
      on ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
    }`}
  >
    {on ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
  </span>
);

/**
 * One assessment line.
 *
 * There is no longer a second figure to show beside it. The countable numbers
 * are taken from the database and written by the server, so a report cannot
 * disagree with what was counted - which is the point of having made them
 * uneditable.
 */
const Line: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 px-4 py-2.5 last:border-0">
    <p className="text-sm text-slate-700">{label}</p>
    <p className="text-right text-sm font-semibold tabular-nums text-slate-900">
      {value === null || value === undefined || value === "" ? (
        <span className="font-normal text-slate-300">—</span>
      ) : (
        value
      )}
    </p>
  </div>
);

interface Props {
  report: EvalReport;
  criteria: EvalCriterion[];
  week?: EvalWeek | null;
}

const ReportCard: React.FC<Props> = ({ report, criteria, week }) => {
  const rows = [
    ...criteria,
    ...(report.we_custom_label ? [{ key: "custom", label: report.we_custom_label }] : []),
  ];

  // The report's own dates, so a column heading is right even if the week
  // helper is not consulted.
  const days = week?.days?.length
    ? week.days
    : DAY_ORDER.map((day) => ({ ...day, date: "" }));

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {report.we_week_start} to {report.we_week_end}
          </p>
          <p className="text-xs text-slate-500">{report.we_week_key}</p>
        </div>
        {report.we_quality && (
          <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
            {report.we_quality}
          </span>
        )}
      </div>

      {report.we_classes && report.we_classes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-5 py-3">
          {report.we_classes.map((entry) => (
            <span
              key={`${entry.center_id}-${entry.course_id}-${entry.tb_id}`}
              className="rounded bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-inset ring-slate-200"
            >
              {entry.center_name} · {entry.course_name} · {entry.tb_name}
            </span>
          ))}
        </div>
      )}

      {/* Who read it. Shown at the top because it is the first thing a
          Master Trainer opening their own report wants to know - somebody
          senior looked at this, or nobody has yet. */}
      {report.we_status === "reviewed" && (
        <div className="flex items-start gap-2.5 border-b border-emerald-100 bg-emerald-50 px-5 py-3">
          <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-emerald-900">
              Reviewed{report.we_reviewed_by_name ? ` by ${report.we_reviewed_by_name}` : ""}
              {report.we_reviewed_on
                ? ` on ${new Date(report.we_reviewed_on).toLocaleDateString()}`
                : ""}
            </p>
            {report.we_review_note && (
              <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-800">
                {report.we_review_note}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Student attendance, counted from the register. */}
      {report.we_attendance && (
        <div className="overflow-x-auto border-b border-slate-100 px-5 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Student attendance
          </p>
          <table className="w-full min-w-[480px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="bg-slate-100 px-3 py-1.5 text-left text-xs font-semibold text-slate-700">
                  &nbsp;
                </th>
                {days.map((day) => (
                  <th
                    key={day.key}
                    className="bg-slate-100 px-2 py-1.5 text-center text-xs font-semibold text-slate-700"
                  >
                    {day.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["P", "Present"],
                  ["A", "Absent"],
                  ["L", "On leave"],
                ] as const
              ).map(([status, label]) => (
                <tr key={status}>
                  <td className="border-b border-slate-100 px-3 py-1.5 text-sm text-slate-700">
                    {label}
                  </td>
                  {days.map((day) => {
                    const cell = report.we_attendance?.[day.key];
                    return (
                      <td
                        key={day.key}
                        className="border-b border-slate-100 px-2 py-1.5 text-center text-sm font-semibold tabular-nums text-slate-800"
                      >
                        {cell?.marked ? (
                          cell[status]
                        ) : (
                          <span className="font-normal text-slate-300" title="No register was marked">
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
      )}

      <div className="overflow-x-auto px-5 py-4">
        <table className="w-full min-w-[520px] border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="bg-slate-100 px-3 py-2 text-left text-xs font-semibold text-slate-700">
                Criteria
              </th>
              {days.map((day) => (
                <th
                  key={day.key}
                  className="bg-slate-100 px-2 py-2 text-center text-xs font-semibold text-slate-700"
                >
                  {day.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((criterion) => (
              <tr key={criterion.key}>
                <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">
                  {criterion.label}
                </td>
                {days.map((day) => (
                  <td key={day.key} className="border-b border-slate-100 px-2 py-2 text-center">
                    <Mark on={Boolean(report.we_daily?.[criterion.key]?.[day.key])} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-100">
        <div className="bg-slate-100 px-5 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Assessment</p>
        </div>

        <Line label="Assignments during this week" value={report.we_assignments} />
        <Line label="Quizzes during this week" value={report.we_quizzes} />
        <Line label="Grading of Training Quality" value={report.we_quality} />
        <Line label="Date of Visit of MT in the last week" value={report.we_mt_visit_date} />
        <Line
          label="Enrolled Students in the start of the week"
          value={report.we_enrolled_start}
        />
        <Line label="Drop-outs during this week" value={report.we_dropouts} />
        <Line label="Newly enrolled during this week" value={report.we_new_enrolled} />
        <Line label="Students on Leave during this week" value={report.we_on_leave} />
        <Line label="Trainees' Feedback" value={report.we_feedback_submission} />
      </div>

      {(report.we_other_tasks || report.we_remarks) && (
        <div className="space-y-3 border-t border-slate-100 px-5 py-4">
          {report.we_other_tasks && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Other tasks assigned and status
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                {report.we_other_tasks}
              </p>
            </div>
          )}
          {report.we_remarks && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Remarks / Complaints
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{report.we_remarks}</p>
            </div>
          )}
        </div>
      )}

      {report.we_submitted_on && (
        <p className="border-t border-slate-100 px-5 py-2.5 text-[11px] text-slate-400">
          Submitted {new Date(report.we_submitted_on).toLocaleString()}
        </p>
      )}
    </div>
  );
};

export default ReportCard;
