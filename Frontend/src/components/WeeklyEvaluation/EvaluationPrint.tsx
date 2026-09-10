import { EvalCriterion, EvalReport, EvalWeek } from "../../services/api";
import {
  PrintDocument,
  PrintSection,
  PrintText,
  formatDate,
  reportDays,
  shortDate,
} from "../print/PrintDocument";

/**
 * The weekly M&E report on one trainer, on one A4 page.
 *
 * Everything the screen shows, in the order the paper form had it: who and
 * when, the register, the daily criteria, the assessment, remarks, and the
 * signatures. Two columns for the assessment because nine short lines in one
 * column is the difference between one page and two.
 */

const ASSESSMENT: Array<[string, keyof EvalReport]> = [
  ["Assignments during this week", "we_assignments"],
  ["Quizzes during this week", "we_quizzes"],
  ["Grading of training quality", "we_quality"],
  ["Date of MT visit in the last week", "we_mt_visit_date"],
  ["Enrolled at the start of the week", "we_enrolled_start"],
  ["Drop-outs during this week", "we_dropouts"],
  ["Newly enrolled during this week", "we_new_enrolled"],
  ["Students on leave during this week", "we_on_leave"],
  ["Trainees' feedback", "we_feedback_submission"],
];

interface Props {
  report: EvalReport;
  criteria: EvalCriterion[];
  week?: EvalWeek | null;
  trainerName: string;
  filedBy?: string | null;
}

const value = (raw: unknown) =>
  raw === null || raw === undefined || raw === "" ? <span className="print-empty">—</span> : String(raw);

export default function EvaluationPrint({ report, criteria, week, trainerName, filedBy }: Props) {
  const days = reportDays(report.we_week_start, week?.days);
  const rows = [
    ...criteria,
    ...(report.we_custom_label ? [{ key: "custom", label: report.we_custom_label }] : []),
  ];
  const classes = (report.we_classes || [])
    .map((entry) => `${entry.center_name} · ${entry.course_name}`)
    .join(";  ");

  // Split down the middle for the two-column assessment table.
  const half = Math.ceil(ASSESSMENT.length / 2);

  return (
    <PrintDocument
      title="Weekly M&E Report"
      subtitle="Trainer performance · physical centre"
      meta={[
        { label: "Trainer", value: trainerName },
        { label: "Master Trainer", value: filedBy },
        {
          label: "Week",
          value: `${formatDate(report.we_week_start)} – ${formatDate(report.we_week_end)}`,
        },
        { label: "Classes", value: classes, wide: true },
      ]}
      status={{
        status: report.we_status,
        submittedOn: report.we_submitted_on,
        reviewedBy: report.we_reviewed_by_name,
        reviewedOn: report.we_reviewed_on,
        note: report.we_review_note,
      }}
      signatures={[
        { role: "Master Trainer", name: filedBy },
        { role: "M&E Officer" },
        { role: "Program Director" },
      ]}
    >
      {report.we_attendance && (
        <PrintSection title="Student attendance · counted from the register">
          <table className="print-table">
            <thead>
              <tr>
                <th />
                {days.map((day) => (
                  <th key={day.key} className="num">
                    {day.label} {shortDate(day.date)}
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
                  <td>{label}</td>
                  {days.map((day) => {
                    const cell = report.we_attendance?.[day.key];
                    return (
                      <td key={day.key} className={`num${cell?.marked ? "" : " muted"}`}>
                        {cell?.marked ? cell[status] : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </PrintSection>
      )}

      <PrintSection title="Daily criteria">
        <table className="print-table">
          <thead>
            <tr>
              <th>Criteria</th>
              {days.map((day) => (
                <th key={day.key} className="num">
                  {day.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((criterion) => (
              <tr key={criterion.key}>
                <td>{criterion.label}</td>
                {days.map((day) => {
                  const on = Boolean(report.we_daily?.[criterion.key]?.[day.key]);
                  return (
                    <td key={day.key} className={`num ${on ? "print-yes" : "print-no"}`}>
                      {on ? "✓" : "✗"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </PrintSection>

      <PrintSection title="Assessment">
        <div className="print-two">
          {[ASSESSMENT.slice(0, half), ASSESSMENT.slice(half)].map((column, index) => (
            <table key={index} className="print-table">
              <tbody>
                {column.map(([label, key]) => (
                  <tr key={key}>
                    <td>{label}</td>
                    <td className="num" style={{ width: "32%" }}>
                      {value(report[key])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      </PrintSection>

      <PrintSection title="Other tasks assigned and status">
        <PrintText value={report.we_other_tasks} />
      </PrintSection>

      <PrintSection title="Remarks / complaints">
        <PrintText value={report.we_remarks} />
      </PrintSection>
    </PrintDocument>
  );
}
