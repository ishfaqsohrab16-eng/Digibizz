import {
  EvalWeek,
  OnlineClassReport,
  OnlineCourseAttendance,
  OnlineQuestion,
} from "../../services/api";
import {
  PrintDocument,
  PrintSection,
  PrintText,
  formatDate,
  reportDays,
  shortDate,
} from "../print/PrintDocument";

/**
 * The Online Classes Report on one A4 page, laid out like the paper form it
 * replaces: the four answers first, then one row of daily counts per course,
 * remarks, and the Online Cell In-charge / M&E Officer / Program Director
 * signatures along the bottom.
 */

interface Props {
  report: OnlineClassReport;
  questions: OnlineQuestion[];
  attendance: OnlineCourseAttendance[];
  filedBy?: string | null;
  week?: EvalWeek | null;
}

export default function OnlineReportPrint({ report, questions, attendance, filedBy, week }: Props) {
  const days = reportDays(report.ocr_week_start, week?.days);

  return (
    <PrintDocument
      title="Online Classes Report"
      subtitle={`${report.ocr_center_name} · ${report.ocr_medium || "Online"} centre`}
      meta={[
        { label: "Centre", value: report.ocr_center_name },
        {
          label: "Week",
          value: `${formatDate(report.ocr_week_start)} – ${formatDate(report.ocr_week_end)}`,
        },
        { label: "Filed by", value: filedBy },
      ]}
      status={{
        status: report.ocr_status,
        submittedOn: report.ocr_submitted_on,
        reviewedBy: report.ocr_reviewed_by_name,
        reviewedOn: report.ocr_reviewed_on,
        note: report.ocr_review_note,
      }}
      signatures={[
        { role: "Online Cell In-charge", name: filedBy },
        { role: "M&E Officer" },
        { role: "Program Director" },
      ]}
    >
      <PrintSection title="This week">
        <table className="print-table">
          <tbody>
            {questions.map((question) => {
              const answer = report.ocr_answers?.[question.key];
              const yes = question.kind === "yesno" && answer === "Yes";
              const no = question.kind === "yesno" && answer === "No";
              return (
                <tr key={question.key}>
                  <td style={{ width: "32%", fontWeight: 600 }}>{question.label}</td>
                  <td className={yes ? "print-yes" : no ? "print-no" : undefined}>
                    {answer || <span className="print-empty">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </PrintSection>

      <PrintSection title="Students present each day · counted from the register">
        {attendance.length === 0 ? (
          <p className="print-note">No courses were allocated at this centre.</p>
        ) : (
          <table className="print-table">
            <thead>
              <tr>
                <th>Course</th>
                {days.map((day) => (
                  <th key={day.key} className="num">
                    {day.label} {shortDate(day.date)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {attendance.map((course) => (
                <tr key={course.course_id}>
                  <td style={{ fontWeight: 600 }}>{course.course_name}</td>
                  {days.map((day) => {
                    const cell = course.days?.[day.key];
                    return (
                      <td key={day.key} className={`num${cell?.marked ? "" : " muted"}`}>
                        {cell?.marked ? cell.P : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="print-note">
          A dash is a day with no register marked. Figures are as recorded when the report was
          submitted.
        </p>
      </PrintSection>

      <PrintSection title="Remarks">
        <PrintText value={report.ocr_remarks} />
      </PrintSection>
    </PrintDocument>
  );
}
