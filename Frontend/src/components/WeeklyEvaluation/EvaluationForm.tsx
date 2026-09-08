import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ClipboardList,
  Database,
  Loader2,
  Save,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  EvalClass,
  EvalCriterion,
  EvalFigure,
  EvalMetrics,
  EvalWeek,
  prepareEvaluation,
  saveEvaluation,
} from "../../services/api";

/**
 * The weekly M&E report, as a form.
 *
 * Laid out to match the paper it replaces - the same two tables in the same
 * order, the day columns headed "Fri Mon Tue Wed Thurs" as printed - because
 * the people filling it in have that page in front of them and a rearranged
 * screen would be slower, not faster, however much tidier it looked.
 *
 * WHAT THE LMS ALREADY KNOWS IS FILLED IN. Nine of the figures can be counted
 * from the database, and counting them from memory on a Friday afternoon is
 * exactly what nobody does accurately. Every one of them stays editable: the
 * Master Trainer was at the centre and the system was not, and it is their
 * signature on the report.
 *
 * Where a figure came from is shown beside it, because "counted from the
 * lecture reports", "worked out from the activity log" and "nothing records
 * this" are three different kinds of number and an MT who cannot tell them
 * apart will either distrust a good one or accept a missing one.
 */

interface Props {
  t_id: number;
  weekKey?: string;
  onBack: () => void;
}

type Daily = Record<string, Record<string, boolean>>;

const YES_NO = ["Yes", "No"];

/** Where a pre-filled number came from, said plainly. */
const SourceNote: React.FC<{ figure?: EvalFigure }> = ({ figure }) => {
  if (!figure) return null;

  const tone =
    figure.source === "counted"
      ? "text-emerald-700"
      : figure.source === "audit"
        ? "text-amber-700"
        : "text-slate-400";

  const Icon = figure.source === "unavailable" ? AlertTriangle : Database;

  return (
    <span className={`mt-1 flex items-start gap-1 text-[11px] leading-snug ${tone}`}>
      <Icon className="mt-px h-3 w-3 shrink-0" />
      {figure.note}
    </span>
  );
};

/** A number the LMS suggested and the MT may correct. */
const CountField: React.FC<{
  label: string;
  value: string;
  figure?: EvalFigure;
  onChange: (value: string) => void;
  disabled?: boolean;
}> = ({ label, value, figure, onChange, disabled }) => {
  const suggested = figure?.value;
  const edited = suggested !== null && suggested !== undefined && String(suggested) !== value;

  return (
    <div className="grid grid-cols-1 gap-2 border-b border-slate-100 px-4 py-3 last:border-0 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <SourceNote figure={figure} />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="w-28 rounded-lg border border-slate-300 px-3 py-1.5 text-right text-sm font-semibold tabular-nums text-slate-900 transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500"
        />
        {/* Only shown once the MT has actually changed it, so the reader can
            see at a glance which figures were corrected by hand. */}
        {edited && !disabled && (
          <button
            type="button"
            onClick={() => onChange(String(suggested))}
            className="whitespace-nowrap rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-200"
            title={`The system counted ${suggested}`}
          >
            reset to {suggested}
          </button>
        )}
      </div>
    </div>
  );
};

const EvaluationForm: React.FC<Props> = ({ t_id, weekKey, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"draft" | "submitted" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [week, setWeek] = useState<EvalWeek | null>(null);
  const [criteria, setCriteria] = useState<EvalCriterion[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [trainer, setTrainer] = useState<{ name: string; cnic: string } | null>(null);
  const [classes, setClasses] = useState<EvalClass[]>([]);
  const [metrics, setMetrics] = useState<EvalMetrics | null>(null);
  const [editable, setEditable] = useState(false);
  const [status, setStatus] = useState<"draft" | "submitted">("draft");

  const [daily, setDaily] = useState<Daily>({});
  const [customLabel, setCustomLabel] = useState("");
  const [fields, setFields] = useState({
    assignments: "",
    quizzes: "",
    quality: "",
    mt_visit_date: "",
    enrolled_start: "",
    dropouts: "",
    new_enrolled: "",
    on_leave: "",
    feedback_submission: "",
    other_tasks: "",
    remarks: "",
  });

  const set = (key: keyof typeof fields, value: string) =>
    setFields((previous) => ({ ...previous, [key]: value }));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await prepareEvaluation(t_id, weekKey);

      setWeek(data.week);
      setCriteria(data.criteria);
      setGrades(data.grades);
      setTrainer(data.trainer);
      setClasses(data.classes || []);
      setMetrics(data.metrics);
      setEditable(data.editable);
      setStatus(data.report?.we_status || "draft");

      const report = data.report;
      const auto = data.metrics;

      /**
       * What a number field starts as.
       *
       * A saved report always wins: it is what was written down, and a blank
       * left deliberately in a draft must stay blank rather than being
       * helpfully refilled from a count that has since changed. Only a form
       * with no report behind it starts from what the LMS worked out.
       */
      const start = (
        saved: number | null | undefined,
        suggested: number | null | undefined
      ) => {
        if (saved !== null && saved !== undefined) return String(saved);
        if (report) return "";
        return suggested === null || suggested === undefined ? "" : String(suggested);
      };

      setFields({
        assignments: start(report?.we_assignments, auto?.assignments.value),
        quizzes: start(report?.we_quizzes, auto?.quizzes.value),
        quality: report?.we_quality || "",
        mt_visit_date: report?.we_mt_visit_date || "",
        enrolled_start: start(report?.we_enrolled_start, auto?.enrolled_start.value),
        dropouts: start(report?.we_dropouts, auto?.dropouts.value),
        new_enrolled: start(report?.we_new_enrolled, auto?.new_enrolled.value),
        on_leave: start(report?.we_on_leave, auto?.on_leave.value),
        feedback_submission: report?.we_feedback_submission || "",
        other_tasks: report?.we_other_tasks || "",
        remarks: report?.we_remarks || "",
      });

      setCustomLabel(report?.we_custom_label || "");

      // The lecture-report row is ticked from the database on a blank form.
      // The other three are the MT's own observation and start empty.
      const seeded: Daily = {};
      for (const criterion of data.criteria) {
        seeded[criterion.key] = {};
        for (const day of data.week.days) {
          seeded[criterion.key][day.key] =
            report?.we_daily?.[criterion.key]?.[day.key] ??
            (criterion.auto ? Boolean(auto?.lecture_reports?.[day.key]) : false);
        }
      }
      if (report?.we_custom_label) {
        seeded.custom = {};
        for (const day of data.week.days) {
          seeded.custom[day.key] = report?.we_daily?.custom?.[day.key] ?? false;
        }
      }
      setDaily(seeded);
    } catch (caught: any) {
      setError(caught?.response?.data?.message || "Could not open that report.");
    } finally {
      setLoading(false);
    }
  }, [t_id, weekKey]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (criterion: string, day: string) => {
    if (!editable) return;
    setDaily((previous) => ({
      ...previous,
      [criterion]: { ...previous[criterion], [day]: !previous[criterion]?.[day] },
    }));
  };

  const rows = useMemo(
    () => [...criteria, ...(customLabel.trim() ? [{ key: "custom", label: customLabel }] : [])],
    [criteria, customLabel]
  );

  const submit = async (nextStatus: "draft" | "submitted") => {
    if (!week) return;

    if (nextStatus === "submitted") {
      const missing: string[] = [];
      if (!fields.quality) missing.push("Grading of Training Quality");
      if (!fields.feedback_submission) missing.push("Trainees' Feedback Submission");
      if (missing.length) {
        toast.error(`Before submitting, please answer: ${missing.join(", ")}`);
        return;
      }
    }

    setSaving(nextStatus);
    try {
      const result = await saveEvaluation({
        t_id,
        week_key: week.key,
        status: nextStatus,
        daily,
        custom_label: customLabel.trim() || null,
        ...fields,
        mt_visit_date: fields.mt_visit_date || null,
      });

      toast.success(result.message);
      if (nextStatus === "submitted") onBack();
      else load();
    } catch (caught: any) {
      toast.error(caught?.response?.data?.message || "Could not save that report.");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error || !week) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-600" />
        <p className="mt-2 text-sm text-amber-900">{error}</p>
        <button
          onClick={onBack}
          className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200"
        >
          Back
        </button>
      </div>
    );
  }

  const locked = !editable;

  return (
    <div className="mx-auto max-w-5xl pb-24">
      {/* ---------------------------------------------------------------- head */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
          All trainers
        </button>

        {status === "submitted" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Submitted — this report can no longer be changed
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 text-white">
          <p className="text-xs font-medium uppercase tracking-widest text-emerald-100">
            DigiBizz Program Weekly M&amp;E Report
          </p>
          <h1 className="mt-0.5 text-xl font-bold">Trainers Performance</h1>
        </div>

        {/* The header block of the paper form: centre, course, trainer, dates. */}
        <div className="grid gap-x-8 gap-y-3 border-b border-slate-200 bg-slate-50/70 px-6 py-4 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Trainer
            </p>
            <p className="text-sm font-semibold text-slate-900">{trainer?.name}</p>
            <p className="text-xs text-slate-500">{trainer?.cnic}</p>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Week
            </p>
            <p className="text-sm font-semibold text-slate-900">
              {week.start} <span className="font-normal text-slate-400">to</span> {week.end}
            </p>
            <p className="text-xs text-slate-500">{week.key}</p>
          </div>

          <div className="sm:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Centre &amp; Course
            </p>
            {/* One report covers every class this trainer teaches, so this is a
                list rather than the single line the paper form has. */}
            {classes.length === 0 ? (
              <p className="text-sm text-amber-700">No classes are allocated to this trainer.</p>
            ) : (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {classes.map((entry) => (
                  <span
                    key={`${entry.center_id}-${entry.course_id}-${entry.tb_id}`}
                    className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200"
                  >
                    {entry.center_name} · {entry.course_name} · {entry.tb_name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------- the day grid */}
        <div className="px-6 py-5">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-800">Criteria by day</h2>
          </div>

          <div className="-mx-6 overflow-x-auto px-6 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[560px] border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 rounded-tl-xl bg-slate-100 px-3 py-2 text-left text-xs font-semibold text-slate-700">
                    Criteria
                  </th>
                  {week.days.map((day, index) => (
                    <th
                      key={day.key}
                      className={`bg-slate-100 px-2 py-2 text-center text-xs font-semibold text-slate-700 ${
                        index === week.days.length - 1 ? "rounded-tr-xl" : ""
                      }`}
                    >
                      {day.label}
                      {/* The date matters: the paper prints Friday first, so
                          without it the column order looks like a mistake. */}
                      <span className="mt-0.5 block text-[10px] font-normal text-slate-400">
                        {day.date.slice(8)}/{day.date.slice(5, 7)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((criterion) => (
                  <tr key={criterion.key} className="group">
                    <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-3 py-2.5 text-sm text-slate-700">
                      {criterion.label}
                      {(criterion as EvalCriterion).auto && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-emerald-700">
                          <Sparkles className="h-2.5 w-2.5" />
                          filled in
                        </span>
                      )}
                    </td>

                    {week.days.map((day) => {
                      const on = Boolean(daily[criterion.key]?.[day.key]);
                      return (
                        <td
                          key={day.key}
                          className="border-b border-slate-100 px-2 py-2.5 text-center"
                        >
                          <button
                            type="button"
                            disabled={locked}
                            onClick={() => toggle(criterion.key, day.key)}
                            aria-pressed={on}
                            aria-label={`${criterion.label}, ${day.label}: ${on ? "yes" : "no"}`}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                              on
                                ? "border-emerald-500 bg-emerald-500 text-white shadow-sm"
                                : "border-slate-200 bg-white text-slate-300"
                            } ${locked ? "cursor-default opacity-70" : "hover:border-emerald-400"}`}
                          >
                            {on ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* The blank fifth row the paper form leaves for a criterion added
              by hand. Only becomes a row once it is named. */}
          {!locked && (
            <input
              value={customLabel}
              onChange={(event) => setCustomLabel(event.target.value)}
              placeholder="Add another criterion (optional)"
              maxLength={120}
              className="mt-3 w-full rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          )}
        </div>

        {/* ------------------------------------------------------- assessment */}
        <div className="border-t border-slate-200">
          <div className="flex items-center gap-2 bg-slate-100 px-6 py-2.5">
            <h2 className="text-sm font-semibold text-slate-800">Assessment</h2>
          </div>

          <CountField
            label="Number of Assignments during this week"
            value={fields.assignments}
            figure={metrics?.assignments}
            onChange={(value) => set("assignments", value)}
            disabled={locked}
          />
          <CountField
            label="Number of Quizzes during this week"
            value={fields.quizzes}
            figure={metrics?.quizzes}
            onChange={(value) => set("quizzes", value)}
            disabled={locked}
          />

          {/* Grading of Training Quality */}
          <div className="grid gap-2 border-b border-slate-100 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="text-sm font-medium text-slate-800">Grading of Training Quality</p>
              <SourceNote figure={metrics?.quality} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {grades.map((grade) => (
                <button
                  key={grade}
                  type="button"
                  disabled={locked}
                  onClick={() => set("quality", grade)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    fields.quality === grade
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  } ${locked ? "cursor-default opacity-70" : ""}`}
                >
                  {grade}
                </button>
              ))}
            </div>
          </div>

          {/* Date of Visit of MT */}
          <div className="grid gap-2 border-b border-slate-100 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="text-sm font-medium text-slate-800">
                Date of Visit of MT in the last week
              </p>
              <SourceNote figure={metrics?.mt_visit_date} />
            </div>
            <input
              type="date"
              value={fields.mt_visit_date}
              disabled={locked}
              onChange={(event) => set("mt_visit_date", event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
            />
          </div>

          <CountField
            label="Number of Enrolled Students in the start of the week"
            value={fields.enrolled_start}
            figure={metrics?.enrolled_start}
            onChange={(value) => set("enrolled_start", value)}
            disabled={locked}
          />
          <CountField
            label="Number of Drop-outs during this week"
            value={fields.dropouts}
            figure={metrics?.dropouts}
            onChange={(value) => set("dropouts", value)}
            disabled={locked}
          />
          <CountField
            label="Number of newly enrolled during this week"
            value={fields.new_enrolled}
            figure={metrics?.new_enrolled}
            onChange={(value) => set("new_enrolled", value)}
            disabled={locked}
          />
          <CountField
            label="Number of Students on Leave during this week"
            value={fields.on_leave}
            figure={metrics?.on_leave}
            onChange={(value) => set("on_leave", value)}
            disabled={locked}
          />

          {/* Trainees' Feedback Submission */}
          <div className="grid gap-2 border-b border-slate-100 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="text-sm font-medium text-slate-800">Trainees&rsquo; Feedback Submission</p>
              <SourceNote figure={metrics?.feedback_submission} />
            </div>
            <div className="flex gap-1.5">
              {YES_NO.map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={locked}
                  onClick={() => set("feedback_submission", option)}
                  className={`w-16 rounded-lg py-1.5 text-xs font-semibold transition ${
                    fields.feedback_submission === option
                      ? option === "Yes"
                        ? "bg-emerald-600 text-white"
                        : "bg-rose-500 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  } ${locked ? "cursor-default opacity-70" : ""}`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 py-3">
            <label className="text-sm font-medium text-slate-800">
              Other tasks assigned and status?
            </label>
            <textarea
              rows={2}
              value={fields.other_tasks}
              disabled={locked}
              onChange={(event) => set("other_tasks", event.target.value)}
              className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
            />
          </div>
        </div>

        {/* -------------------------------------------------------- remarks */}
        <div className="border-t border-slate-200">
          <div className="bg-slate-100 px-6 py-2.5">
            <h2 className="text-sm font-semibold text-slate-800">Remarks / Complaints</h2>
          </div>
          <div className="px-4 py-3">
            <textarea
              rows={4}
              value={fields.remarks}
              disabled={locked}
              onChange={(event) => set("remarks", event.target.value)}
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
            />
          </div>
        </div>
      </div>

      {/* A sticky bar, because the form is long and a save button at the very
          bottom is one people scroll past and forget. */}
      {!locked && (
        <div className="sticky bottom-0 z-20 mt-4 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
          <p className="mr-auto text-xs text-slate-500">
            A draft is yours alone. Submitting signs it off and cannot be undone.
          </p>
          <button
            onClick={() => submit("draft")}
            disabled={saving !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            {saving === "draft" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save draft
          </button>
          <button
            onClick={() => submit("submitted")}
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
      )}
    </div>
  );
};

export default EvaluationForm;
