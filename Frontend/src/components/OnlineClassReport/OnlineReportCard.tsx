import React from "react";
import { BadgeCheck, Globe } from "lucide-react";
import {
  EvalWeek,
  OnlineClassReport,
  OnlineCourseAttendance,
  OnlineQuestion,
} from "../../services/api";
import OnlineAttendanceTable from "./OnlineAttendanceTable";

/**
 * A filed Online Classes Report, read back.
 *
 * Its own component because both the Master Trainer's read-only view and the
 * admin's view need it, and a read-only mode bolted onto the form would make
 * every change to the form a change to two behaviours at once.
 */
interface Props {
  report: OnlineClassReport;
  questions: OnlineQuestion[];
  attendance: OnlineCourseAttendance[];
  filedBy?: string | null;
  week?: EvalWeek | null;
}

const OnlineReportCard: React.FC<Props> = ({ report, questions, attendance, filedBy, week }) => (
  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-200">
          <Globe className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {report.ocr_center_name}
            <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-700">
              {report.ocr_medium || "Online"}
            </span>
          </p>
          <p className="text-xs text-slate-500">
            {report.ocr_week_start} to {report.ocr_week_end}
            {filedBy ? ` · ${filedBy}` : ""}
          </p>
        </div>
      </div>
    </div>

    {/* Who read it - first, because it is the first thing a Master Trainer
        opening their own report wants to know. */}
    {report.ocr_status === "reviewed" && (
      <div className="flex items-start gap-2.5 border-b border-emerald-100 bg-emerald-50 px-5 py-3">
        <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <div>
          <p className="text-sm font-semibold text-emerald-900">
            Reviewed{report.ocr_reviewed_by_name ? ` by ${report.ocr_reviewed_by_name}` : ""}
            {report.ocr_reviewed_on
              ? ` on ${new Date(report.ocr_reviewed_on).toLocaleDateString()}`
              : ""}
          </p>
          {report.ocr_review_note && (
            <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-800">
              {report.ocr_review_note}
            </p>
          )}
        </div>
      </div>
    )}

    <div className="divide-y divide-slate-100">
      {questions.map((question) => {
        const answer = report.ocr_answers?.[question.key];
        return (
          <div key={question.key} className="grid gap-1 px-5 py-3 sm:grid-cols-[14rem_1fr]">
            <p className="text-sm font-medium text-slate-600">{question.label}</p>
            {question.kind === "yesno" ? (
              <span
                className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                  answer === "Yes"
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : answer === "No"
                      ? "bg-rose-50 text-rose-700 ring-rose-200"
                      : "bg-slate-50 text-slate-400 ring-slate-200"
                }`}
              >
                {answer || "—"}
              </span>
            ) : (
              <p className="whitespace-pre-wrap text-sm text-slate-800">
                {answer || <span className="text-slate-300">—</span>}
              </p>
            )}
          </div>
        );
      })}
    </div>

    <div className="border-t border-slate-100 px-5 py-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Students present each day
      </p>
      <OnlineAttendanceTable
        attendance={attendance}
        weekStart={report.ocr_week_start}
        week={week}
      />
    </div>

    {report.ocr_remarks && (
      <div className="border-t border-slate-100 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Remarks</p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{report.ocr_remarks}</p>
      </div>
    )}

    {report.ocr_submitted_on && (
      <p className="border-t border-slate-100 px-5 py-2.5 text-[11px] text-slate-400">
        Submitted {new Date(report.ocr_submitted_on).toLocaleString()}
      </p>
    )}
  </div>
);

export default OnlineReportCard;
