import React, { useEffect, useState } from "react";
import { ArrowLeft, FileEdit, History, Loader2 } from "lucide-react";
import { EvalCriterion, EvalReport, getEvaluationHistory } from "../../services/api";
import ReportCard from "./ReportCard";
import { PrintButton } from "../print/PrintSheet";
import EvaluationPrint from "./EvaluationPrint";

/**
 * Every report written about one trainer, newest week first.
 *
 * The criteria come from the API elsewhere, but a history page can be opened
 * without having loaded a form first - so the four labels are repeated here
 * rather than fetched. They are on a printed form that has not changed; the
 * cost of them drifting is a wrong label, and the cost of an extra round trip
 * is a slower page every time.
 */
const CRITERIA: EvalCriterion[] = [
  { key: "lecture_reports", label: "Daily Lecture Reports Submission" },
  { key: "course_mapping", label: "Course Mapping" },
  { key: "class_time", label: "Completion of 2 Hours Class Time" },
  { key: "presence", label: "Presence at center 1 Hour Prior to the class" },
];

interface Props {
  t_id: number;
  trainerName: string;
  onBack: () => void;
}

const EvaluationHistory: React.FC<Props> = ({ t_id, trainerName, onBack }) => {
  const [reports, setReports] = useState<EvalReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;

    getEvaluationHistory(t_id)
      .then((data) => live && setReports(data.reports))
      .catch(
        (caught: any) =>
          live && setError(caught?.response?.data?.message || "Could not load past reports.")
      )
      .finally(() => live && setLoading(false));

    return () => {
      live = false;
    };
  }, [t_id]);

  return (
    <div className="mx-auto max-w-3xl pb-12">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="mb-4">
        <h1 className="text-lg font-bold text-slate-900">{trainerName}</h1>
        <p className="text-sm text-slate-500">Weekly M&amp;E reports, most recent first</p>
      </div>

      {loading && (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </div>
      )}

      {!loading && !error && reports.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <History className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-700">No reports yet</p>
          <p className="mt-1 text-xs text-slate-500">
            The first one you submit for this trainer will appear here.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {reports.map((report) => (
          <div key={report.we_id}>
            {report.we_status === "draft" && (
              <p className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                <FileEdit className="h-3.5 w-3.5" />
                Draft — not yet submitted
              </p>
            )}
            <div className="mb-1.5 flex justify-end">
              <PrintButton
                render={() => (
                  <EvaluationPrint
                    report={report}
                    criteria={CRITERIA}
                    trainerName={trainerName}
                    filedBy={report.filed_by}
                  />
                )}
              />
            </div>
            <ReportCard report={report} criteria={CRITERIA} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default EvaluationHistory;
