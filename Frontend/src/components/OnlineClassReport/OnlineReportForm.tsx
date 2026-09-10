import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Globe, Loader2, Lock, Save, Send } from "lucide-react";
import { toast } from "sonner";
import {
  EvalWeek,
  OnlineAnswers,
  OnlineClassReport,
  OnlineCourseAttendance,
  OnlineQuestion,
  prepareOnlineReport,
  saveOnlineReport,
} from "../../services/api";
import { describeWeek } from "../WeeklyEvaluation/WeekPicker";
import { PrintButton } from "../print/PrintSheet";
import OnlineAttendanceTable from "./OnlineAttendanceTable";
import OnlineReportCard from "./OnlineReportCard";
import OnlineReportPrint from "./OnlineReportPrint";

/**
 * Filling in the Online Classes Report for one centre.
 *
 * Three states, decided by the server rather than guessed here:
 *
 *   EDITABLE - nobody has filed it, or this Master Trainer has a draft.
 *
 *   CLAIMED - a colleague has it. There is one report per centre, so the
 *   form is not offered at all; the screen says whose it is, and once they
 *   have submitted it, shows what they wrote.
 *
 *   FILED - this Master Trainer submitted it. Read-only, printable.
 */
interface Props {
  tb_id: number;
  centerId: number;
  weekKey?: string;
  onBack: () => void;
}

interface Prepared {
  center: { center_id: number; center_name: string; medium: string };
  week: EvalWeek;
  questions: OnlineQuestion[];
  attendance: OnlineCourseAttendance[];
  report: OnlineClassReport | null;
  filed_by: string | null;
  editable: boolean;
  claimed: boolean;
}

const OnlineReportForm: React.FC<Props> = ({ tb_id, centerId, weekKey, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Prepared | null>(null);
  const [answers, setAnswers] = useState<OnlineAnswers>({});
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState<"draft" | "submitted" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const prepared = await prepareOnlineReport(tb_id, centerId, weekKey);
      setData(prepared);
      setAnswers(prepared.report?.ocr_answers || {});
      setRemarks(prepared.report?.ocr_remarks || "");
    } catch (caught: any) {
      setError(caught?.response?.data?.message || "Could not open this report.");
    } finally {
      setLoading(false);
    }
  }, [tb_id, centerId, weekKey]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (status: "draft" | "submitted") => {
    if (!data) return;

    if (status === "submitted") {
      const missing = data.questions
        .filter((question) => !String(answers[question.key] ?? "").trim())
        .map((question) => question.label);
      if (missing.length) {
        toast.error(`Before submitting, please answer: ${missing.join(", ")}`);
        return;
      }

      // Irreversible in two ways at once, so it is said.
      const sure = window.confirm(
        `Submit the Online Classes Report for ${data.center.center_name}?\n\n` +
          "Once submitted it cannot be changed, and no other Master Trainer can file one " +
          "for this centre this week."
      );
      if (!sure) return;
    }

    setSaving(status);
    try {
      const result = await saveOnlineReport({
        tb_id,
        center_id: centerId,
        week_key: data.week.key,
        answers,
        remarks,
        status,
      });
      toast.success(result.message);
      if (status === "submitted") onBack();
      else load();
    } catch (caught: any) {
      toast.error(caught?.response?.data?.message || "Could not save this report.");
      // A colleague may have claimed it in the meantime; show that.
      if (caught?.response?.status === 409) load();
    } finally {
      setSaving(null);
    }
  };

  const back = (
    <button
      onClick={onBack}
      className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to the centres
    </button>
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl pb-12">
        {back}
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl pb-12">
        {back}
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {error || "Could not open this report."}
        </div>
      </div>
    );
  }

  const filed = data.report && data.report.ocr_status !== "draft";

  // --------------------------------------------------------- read-only
  if (!data.editable) {
    return (
      <div className="mx-auto max-w-3xl pb-12">
        {back}

        {data.claimed && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-900">
              <span className="font-semibold">{data.filed_by || "Another Master Trainer"}</span>{" "}
              {filed ? "has filed" : "is writing"} this centre&rsquo;s report for{" "}
              {describeWeek(data.week)}. There is one report per centre.
            </p>
          </div>
        )}

        {data.report && filed ? (
          <>
            <div className="mb-3 flex justify-end">
              <PrintButton
                render={() => (
                  <OnlineReportPrint
                    report={data.report as OnlineClassReport}
                    questions={data.questions}
                    attendance={data.attendance}
                    filedBy={data.filed_by}
                    week={data.week}
                  />
                )}
              />
            </div>
            <OnlineReportCard
              report={data.report}
              questions={data.questions}
              attendance={data.attendance}
              filedBy={data.filed_by}
              week={data.week}
            />
          </>
        ) : (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            It will appear here once it has been submitted.
          </p>
        )}
      </div>
    );
  }

  // ------------------------------------------------------------ the form
  return (
    <div className="mx-auto max-w-3xl pb-12">
      {back}

      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-200">
          <Globe className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
            Online Classes Report · {data.center.medium}
          </p>
          <h1 className="text-xl font-bold text-slate-900">{data.center.center_name}</h1>
          <p className="text-sm text-slate-500">{describeWeek(data.week)}</p>
        </div>
      </div>

      <div className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Students present each day</h2>
            <p className="text-xs text-slate-500">Counted from the register — not editable</p>
          </div>
          <OnlineAttendanceTable
            attendance={data.attendance}
            weekStart={data.week.start}
            week={data.week}
          />
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          {data.questions.map((question) => (
            <div key={question.key}>
              <label className="text-sm font-semibold text-slate-800">{question.label}</label>

              {question.kind === "yesno" ? (
                <div className="mt-2 flex gap-2">
                  {(["Yes", "No"] as const).map((option) => {
                    const on = answers[question.key] === option;
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() =>
                          setAnswers((current) => ({ ...current, [question.key]: option }))
                        }
                        className={`rounded-lg px-5 py-2 text-sm font-semibold ring-1 ring-inset transition ${
                          on
                            ? option === "Yes"
                              ? "bg-emerald-600 text-white ring-emerald-600"
                              : "bg-rose-600 text-white ring-rose-600"
                            : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <textarea
                  rows={2}
                  maxLength={500}
                  value={answers[question.key] || ""}
                  onChange={(event) =>
                    setAnswers((current) => ({ ...current, [question.key]: event.target.value }))
                  }
                  placeholder={question.hint}
                  className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              )}
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <label className="text-sm font-semibold text-slate-800">
            Remarks <span className="font-normal text-slate-400">optional</span>
          </label>
          <textarea
            rows={4}
            maxLength={4000}
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            placeholder="Anything else about this centre this week"
            className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </section>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={() => save("draft")}
            disabled={saving !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            {saving === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save draft
          </button>
          <button
            onClick={() => save("submitted")}
            disabled={saving !== null}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving === "submitted" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Submit report
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnlineReportForm;
