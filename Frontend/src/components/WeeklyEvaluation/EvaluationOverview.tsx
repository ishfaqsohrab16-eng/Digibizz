import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileEdit,
  Loader2,
  Search,
  ShieldAlert,
} from "lucide-react";
import {
  EvalCriterion,
  EvalOverviewRow,
  EvalReport,
  EvalWeek,
  getEvaluation,
  getEvaluationOverview,
} from "../../services/api";
import WeekPicker, { describeWeek } from "./WeekPicker";
import ReportCard from "./ReportCard";

/**
 * Every trainer in the programme for one week, reported on or not.
 *
 * The admin view. A list of what WAS submitted answers "what do we have"; the
 * question that changes anyone's behaviour is "who has not done it yet", so
 * the missing rows are counted first, shown first, and filterable on their own.
 *
 * Trainers with no class allocated are separated out rather than counted as
 * missing. There is nothing to evaluate about a trainer who is not teaching,
 * and including them would make the outstanding figure meaningless.
 */

const STATUS_LOOK = {
  submitted: {
    label: "Submitted",
    className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    Icon: CheckCircle2,
  },
  draft: {
    label: "Draft only",
    className: "bg-amber-50 text-amber-800 ring-amber-200",
    Icon: FileEdit,
  },
  missing: {
    label: "Not submitted",
    className: "bg-rose-50 text-rose-700 ring-rose-200",
    Icon: AlertTriangle,
  },
} as const;

const CRITERIA: EvalCriterion[] = [
  { key: "lecture_reports", label: "Daily Lecture Reports Submission" },
  { key: "course_mapping", label: "Course Mapping" },
  { key: "class_time", label: "Completion of 2 Hours Class Time" },
  { key: "presence", label: "Presence at center 1 Hour Prior to the class" },
];

const Stat: React.FC<{
  label: string;
  value: number;
  tone: "slate" | "emerald" | "amber" | "rose";
  active?: boolean;
  onClick?: () => void;
}> = ({ label, value, tone, active, onClick }) => {
  const tint = {
    slate: "text-slate-900",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-xl border px-4 py-3 text-left transition ${
        active ? "border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-200" : "border-slate-200 bg-white"
      } ${onClick ? "hover:border-slate-300 hover:shadow-sm" : "cursor-default"}`}
    >
      <p className={`text-2xl font-bold tabular-nums ${tint}`}>{value}</p>
      <p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p>
    </button>
  );
};

const EvaluationOverview: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [week, setWeek] = useState<EvalWeek | null>(null);
  const [weeks, setWeeks] = useState<EvalWeek[]>([]);
  const [rows, setRows] = useState<EvalOverviewRow[]>([]);
  const [summary, setSummary] = useState({ teaching: 0, submitted: 0, draft: 0, missing: 0 });
  // False for a week that predates this module. Those reports were filed on
  // paper and are not missing, they are in a folder.
  const [chased, setChased] = useState(true);

  const [weekKey, setWeekKey] = useState<string | undefined>();
  const [filter, setFilter] = useState<"all" | "submitted" | "draft" | "missing">("all");
  const [search, setSearch] = useState("");

  const [open, setOpen] = useState<{ report: EvalReport; week: EvalWeek | null } | null>(null);
  const [opening, setOpening] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getEvaluationOverview(weekKey);
      setWeek(data.week);
      setWeeks(data.weeks);
      setRows(data.rows);
      setSummary(data.summary);
      setChased(data.chased !== false);
    } catch (caught: any) {
      setError(caught?.response?.data?.message || "Could not load the overview.");
    } finally {
      setLoading(false);
    }
  }, [weekKey]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();

    return rows
      .filter((row) => (filter === "all" ? true : row.status === filter))
      .filter((row) =>
        term
          ? row.name.toLowerCase().includes(term) ||
            (row.master_trainer || "").toLowerCase().includes(term)
          : true
      )
      .sort((a, b) => {
        // Not teaching last; then missing, draft, submitted - worst first,
        // because this page exists to find what is outstanding.
        const rank = (row: EvalOverviewRow) =>
          !row.teaching ? 3 : row.status === "missing" ? 0 : row.status === "draft" ? 1 : 2;
        return rank(a) - rank(b) || a.name.localeCompare(b.name);
      });
  }, [rows, filter, search]);

  const show = async (we_id: number) => {
    setOpening(true);
    try {
      const data = await getEvaluation(we_id);
      setOpen({ report: data.report, week: data.week });
    } catch {
      setError("Could not open that report.");
    } finally {
      setOpening(false);
    }
  };

  if (open) {
    return (
      <div className="mx-auto max-w-3xl pb-12">
        <button
          onClick={() => setOpen(null)}
          className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to the week
        </button>
        <div className="mb-3">
          <h1 className="text-lg font-bold text-slate-900">
            {open.report.trainer?.user?.user_name || `Trainer ${open.report.t_id}`}
          </h1>
        </div>
        <ReportCard report={open.report} criteria={CRITERIA} week={open.week} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl pb-12">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Weekly M&amp;E Reports</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Trainers performance across the programme
          </p>
        </div>
        {week && (
          <WeekPicker week={week} weeks={weeks} disabled={loading} onChange={setWeekKey} />
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="Trainers teaching"
          value={summary.teaching}
          tone="slate"
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        <Stat
          label="Submitted"
          value={summary.submitted}
          tone="emerald"
          active={filter === "submitted"}
          onClick={() => setFilter("submitted")}
        />
        <Stat
          label="Draft only"
          value={summary.draft}
          tone="amber"
          active={filter === "draft"}
          onClick={() => setFilter("draft")}
        />
        <Stat
          label={chased ? "Not submitted" : "On paper"}
          value={summary.missing}
          tone={chased ? "rose" : "slate"}
          active={filter === "missing"}
          onClick={() => setFilter("missing")}
        />
      </div>

      {/* Only for a week this module is responsible for. Before it, a red
          banner would be a permanent accusation about work that was done
          correctly on paper and can never be cleared from here. */}
      {!chased && week && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <FileEdit className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
          <div>
            <p className="text-sm font-semibold text-slate-700">
              {describeWeek(week)} was recorded on paper
            </p>
            <p className="text-xs text-slate-500">
              This module took over from a later week, so nothing is outstanding here. Anything
              submitted for this week was typed up from a paper form.
            </p>
          </div>
        </div>
      )}

      {chased && week && summary.missing > 0 && filter === "all" && (
        <button
          onClick={() => setFilter("missing")}
          className="mb-4 flex w-full items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-left transition hover:bg-rose-100/60"
        >
          <ShieldAlert className="h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <p className="text-sm font-semibold text-rose-900">
              {summary.missing} of {summary.teaching} trainers have no report for{" "}
              {describeWeek(week)}
            </p>
            <p className="text-xs text-rose-800">Show only those</p>
          </div>
        </button>
      )}

      <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search a trainer or a Master Trainer"
          className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
        />
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

      {!loading && !error && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {visible.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              Nothing matches that filter.
            </p>
          )}

          {visible.map((row) => {
            const look = STATUS_LOOK[row.status];
            return (
              <div
                key={row.t_id}
                className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{row.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {row.master_trainer
                      ? `Master Trainer: ${row.master_trainer}`
                      : "No Master Trainer assigned"}
                  </p>
                </div>

                {!row.teaching ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
                    No class allocated
                  </span>
                ) : (
                  <span
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${look.className}`}
                  >
                    <look.Icon className="h-3.5 w-3.5" />
                    {look.label}
                  </span>
                )}

                {row.quality && (
                  <span className="hidden rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 sm:inline">
                    {row.quality}
                  </span>
                )}

                <button
                  disabled={!row.we_id || row.status !== "submitted" || opening}
                  onClick={() => row.we_id && show(row.we_id)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
                >
                  View
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EvaluationOverview;
