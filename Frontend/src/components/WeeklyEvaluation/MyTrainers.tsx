import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
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
  getMyTrainersForEvaluation,
} from "../../services/api";
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

const StatusPill: React.FC<{ status: "submitted" | "draft" | "missing" }> = ({ status }) => {
  const look = {
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
  const [view, setView] = useState<View>({ name: "list" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [week, setWeek] = useState<EvalWeek | null>(null);
  const [weeks, setWeeks] = useState<EvalWeek[]>([]);
  const [trainers, setTrainers] = useState<EvalTrainerRow[]>([]);
  const [weekKey, setWeekKey] = useState<string | undefined>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyTrainersForEvaluation(weekKey);
      setWeek(data.week);
      setWeeks(data.weeks);
      setTrainers(data.trainers);
    } catch (caught: any) {
      setError(caught?.response?.data?.message || "Could not load your trainers.");
    } finally {
      setLoading(false);
    }
  }, [weekKey]);

  useEffect(() => {
    if (view.name === "list") load();
  }, [load, view.name]);

  if (view.name === "form") {
    return (
      <EvaluationForm
        t_id={view.t_id}
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

  const outstanding = trainers.filter(
    (trainer) => trainer.classes.length > 0 && trainer.report?.status !== "submitted"
  ).length;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Weekly M&amp;E Reports</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Trainers performance, for the trainers who report to you
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

      {!loading && !error && trainers.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <Users className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-700">No trainers report to you yet</p>
          <p className="mt-1 text-xs text-slate-500">
            A trainer appears here once they are assigned to you as their Master Trainer.
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
              row.classes.length === 0 ? 2 : row.report?.status === "submitted" ? 1 : 0;
            return rank(a) - rank(b) || a.name.localeCompare(b.name);
          })
          .map((trainer) => {
            const status = trainer.report?.status || "missing";
            const teaching = trainer.classes.length > 0;

            return (
              <div
                key={trainer.t_id}
                className="group flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{trainer.name}</p>
                    {teaching ? (
                      <StatusPill status={status} />
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
                        No class allocated
                      </span>
                    )}
                  </div>

                  {teaching ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {trainer.classes.map((entry) => (
                        <span
                          key={`${entry.center_id}-${entry.course_id}-${entry.tb_id}`}
                          className="rounded bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-inset ring-slate-200"
                        >
                          {entry.center_name} · {entry.course_name} · {entry.tb_name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-slate-400">
                      Nothing to evaluate until a class is assigned.
                    </p>
                  )}
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
                    disabled={!teaching || !week}
                    onClick={() =>
                      week && setView({ name: "form", t_id: trainer.t_id, weekKey: week.key })
                    }
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                      status === "submitted"
                        ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        : "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    {status === "submitted" ? "View" : status === "draft" ? "Continue" : "Fill in"}
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
