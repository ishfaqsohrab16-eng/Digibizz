import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileEdit,
  History,
  Loader2,
  Users,
} from "lucide-react";
import {
  EvalTrainerRow,
  EvalWeek,
  EvalWindow,
  getMyTrainersForEvaluation,
} from "../../services/api";
import { useBatch } from "../../context/BatchContext";
import WeekPicker, { describeWeek } from "./WeekPicker";
import EvaluationForm from "./EvaluationForm";
import EvaluationHistory from "./EvaluationHistory";

/**
 * A Master Trainer's own list: who reports to them, and what is outstanding.
 *
 * The screen the module opens on, and it is organised around the one question
 * an MT has - what do I still owe for this week. So the trainers with nothing
 * submitted come first, and the week can be stepped backwards to catch up on
 * one that was missed.
 */

type View =
  | { name: "list" }
  | { name: "form"; t_id: number; weekKey: string }
  | { name: "history"; t_id: number; trainerName: string };

/** The centres a trainer was teaching at in the week being reported on. */
const ClassChips: React.FC<{ classes: EvalTrainerRow["classes"] }> = ({ classes }) => (
  <div className="mt-1.5 flex flex-wrap gap-1">
    {classes.map((entry) => (
      <span
        key={`${entry.center_id}-${entry.course_id}-${entry.tb_id}`}
        title={
          entry.active === false && entry.dates
            ? `This centre runs from ${entry.dates.start} to ${entry.dates.end}`
            : undefined
        }
        className={`rounded px-2 py-0.5 text-[11px] ring-1 ring-inset ${
          entry.active === false
            ? "bg-slate-50 text-slate-400 ring-slate-200 line-through"
            : "bg-slate-50 text-slate-600 ring-slate-200"
        }`}
      >
        {entry.center_name} · {entry.course_name}
      </span>
    ))}
  </div>
);

const StatusPill: React.FC<{ status: "submitted" | "reviewed" | "draft" | "missing" }> = ({
  status,
}) => {
  const look = {
    // The second signature. A Master Trainer seeing this knows somebody
    // senior actually read what they wrote, which is the whole reason the
    // review stage is recorded at all.
    reviewed: {
      className: "bg-emerald-600 text-white ring-emerald-600",
      label: "Reviewed",
      Icon: BadgeCheck,
    },
    submitted: {
      className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
      label: "Submitted",
      Icon: CheckCircle2,
    },
    draft: {
      className: "bg-amber-50 text-amber-800 ring-amber-200",
      label: "Draft saved",
      Icon: FileEdit,
    },
    missing: {
      className: "bg-rose-50 text-rose-700 ring-rose-200",
      label: "Not submitted",
      Icon: AlertTriangle,
    },
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${look.className}`}
    >
      <look.Icon className="h-3.5 w-3.5" />
      {look.label}
    </span>
  );
};

const MyTrainers: React.FC = () => {
  // The batch is the one selected app-wide, so this module agrees with every
  // other screen about which batch is being looked at.
  const { selectedBatchId, selectedBatchName } = useBatch();

  const [view, setView] = useState<View>({ name: "list" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [week, setWeek] = useState<EvalWeek | null>(null);
  const [weeks, setWeeks] = useState<EvalWeek[]>([]);
  const [teaching, setTeaching] = useState<EvalWindow | null>(null);
  const [trainers, setTrainers] = useState<EvalTrainerRow[]>([]);
  const [weekKey, setWeekKey] = useState<string | undefined>();

  // A different batch is a different set of trainers and a different set of
  // weeks, so the chosen week must not carry across.
  useEffect(() => {
    setWeekKey(undefined);
  }, [selectedBatchId]);

  const load = useCallback(async () => {
    if (!selectedBatchId || selectedBatchId < 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getMyTrainersForEvaluation(selectedBatchId, weekKey);
      setWeek(data.week);
      setWeeks(data.weeks);
      setTeaching(data.window);
      setTrainers(data.trainers);
    } catch (caught: any) {
      setError(caught?.response?.data?.message || "Could not load your trainers.");
    } finally {
      setLoading(false);
    }
  }, [weekKey, selectedBatchId]);

  useEffect(() => {
    if (view.name === "list") load();
  }, [load, view.name]);

  if (view.name === "form") {
    return (
      <EvaluationForm
        t_id={view.t_id}
        tb_id={selectedBatchId}
        weekKey={view.weekKey}
        onBack={() => setView({ name: "list" })}
      />
    );
  }

  if (view.name === "history") {
    return (
      <EvaluationHistory
        t_id={view.t_id}
        trainerName={view.trainerName}
        onBack={() => setView({ name: "list" })}
      />
    );
  }

  // Every trainer here has a class - the server only returns allocated ones -
  // so an outstanding report is simply one not yet submitted.
  const outstanding = trainers.filter(
    (trainer) => !["submitted", "reviewed"].includes(trainer.report?.status || "")
  ).length;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Weekly M&amp;E Reports</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Trainers teaching your course
            {selectedBatchName ? ` in ${selectedBatchName}` : ""}
          </p>
        </div>

        {week && (
          <WeekPicker
            week={week}
            weeks={weeks}
            disabled={loading}
            onChange={(key) => setWeekKey(key)}
          />
        )}
      </div>

      {/* The one number that matters, said before the list rather than left to
          be counted off it. */}
      {!loading && !error && week && (
        <div
          className={`mb-4 flex items-start gap-3 rounded-xl border p-4 ${
            outstanding > 0
              ? "border-amber-200 bg-amber-50"
              : "border-emerald-200 bg-emerald-50"
          }`}
        >
          {outstanding > 0 ? (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          )}
          <div>
            <p
              className={`text-sm font-semibold ${
                outstanding > 0 ? "text-amber-900" : "text-emerald-900"
              }`}
            >
              {outstanding > 0
                ? `${outstanding} report${outstanding === 1 ? "" : "s"} still to submit for ${describeWeek(week)}`
                : `Everything is submitted for ${describeWeek(week)}`}
            </p>
            <p
              className={`mt-0.5 text-xs ${
                outstanding > 0 ? "text-amber-800" : "text-emerald-800"
              }`}
            >
              {outstanding > 0
                ? "Assignments, quizzes, enrolment and lecture reports are filled in for you — check them and add your own assessment."
                : "You can still step back to an earlier week if one was missed."}
            </p>
          </div>
        </div>
      )}

      {(!selectedBatchId || selectedBatchId < 0) && !loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-700">Choose a batch first</p>
          <p className="mt-1 text-xs text-slate-500">
            Reports belong to a batch, and each centre in a batch has its own dates.
          </p>
        </div>
      )}

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

      {!loading && !error && selectedBatchId > 0 && trainers.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <Users className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-700">
            Nobody is teaching your course in this batch
          </p>
          <p className="mt-1 text-xs text-slate-500">
            A trainer appears here once they are allocated a class on your course in this batch.
          </p>
        </div>
      )}

      {!loading && !error && trainers.length > 0 && !teaching && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            This batch has no start and end dates recorded for its centres
          </p>
          <p className="mt-0.5 text-xs text-amber-800">
            Reports run between a centre's own dates, so those need setting before a week can be
            reported on.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {trainers
          // Outstanding first: this is a to-do list, and the finished rows are
          // the ones nobody needs to look at.
          .slice()
          .sort((a, b) => {
            const rank = (row: EvalTrainerRow) =>
              row.report?.status === "submitted" ? 1 : 0;
            return rank(a) - rank(b) || a.name.localeCompare(b.name);
          })
          .map((trainer) => {
            const status = trainer.report?.status || "missing";

            return (
              <div
                key={trainer.t_id}
                className="group flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{trainer.name}</p>
                    <StatusPill status={status} />
                  </div>

                  <ClassChips classes={trainer.classes} />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setView({ name: "history", t_id: trainer.t_id, trainerName: trainer.name })
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                  >
                    <History className="h-3.5 w-3.5" />
                    Past reports
                  </button>

                  <button
                    disabled={!week}
                    onClick={() =>
                      week && setView({ name: "form", t_id: trainer.t_id, weekKey: week.key })
                    }
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                      status === "submitted" || status === "reviewed"
                        ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        : "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    {status === "submitted" || status === "reviewed"
                      ? "View"
                      : status === "draft"
                        ? "Continue"
                        : "Fill in"}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default MyTrainers;
