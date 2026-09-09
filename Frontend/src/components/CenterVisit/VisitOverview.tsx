import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Building2,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileEdit,
  Globe,
  Loader2,
  ShieldAlert,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  CenterVisit,
  EvalWeek,
  VisitOverviewEntry,
  VisitOverviewRow,
  VisitQuestion,
  getVisit,
  getVisitOverview,
  reviewVisit,
} from "../../services/api";
import { useBatch } from "../../context/BatchContext";
import WeekPicker, { describeWeek } from "../WeeklyEvaluation/WeekPicker";
import VisitReport from "./VisitReport";

/**
 * Every centre for one week, and how much of it has come in.
 *
 * The admin view, and the gaps are the point of it. A list of where somebody
 * went answers "what do we have"; the question that changes anyone's behaviour
 * is "who has not been".
 *
 * Every Master Trainer visits every physical centre, so a centre is not
 * visited-or-not but counted: five expected, three filed, two people to chase.
 * Opening a centre lists them by name. The Online Cell is the exception -
 * nobody travels to it, one report covers it, and its count is one.
 */

/** How a centre is doing: what came in against what was expected. */
const CENTER_LOOK = {
  complete: {
    label: "All in",
    className: "bg-emerald-600 text-white ring-emerald-600",
    Icon: CheckCircle2,
  },
  partial: {
    label: "Some missing",
    className: "bg-amber-50 text-amber-800 ring-amber-200",
    Icon: AlertTriangle,
  },
  missing: {
    label: "Nobody has been",
    className: "bg-rose-50 text-rose-700 ring-rose-200",
    Icon: ShieldAlert,
  },
} as const;

/** How one report is doing. */
const REPORT_LOOK = {
  reviewed: {
    label: "Reviewed",
    className: "bg-emerald-600 text-white ring-emerald-600",
    Icon: BadgeCheck,
  },
  submitted: {
    label: "Awaiting review",
    className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    Icon: CheckCircle2,
  },
  draft: {
    label: "Draft only",
    className: "bg-amber-50 text-amber-800 ring-amber-200",
    Icon: FileEdit,
  },
} as const;

/**
 * The reports filed about one centre, once it is opened.
 *
 * A draft is listed but cannot be read: it is somebody's unfinished writing,
 * and counting it as filed would let a Master Trainer clear the chase without
 * saying anything.
 */
const Filed: React.FC<{
  visits: VisitOverviewEntry[];
  onOpen: (cv_id: number) => void;
}> = ({ visits, onOpen }) => {
  if (visits.length === 0) {
    return (
      <p className="px-4 pb-3 pl-16 text-xs text-slate-500">
        Nothing has been filed about this centre yet.
      </p>
    );
  }

  return (
    <ul className="space-y-1 px-4 pb-3 pl-16">
      {visits.map((entry) => {
        const look = REPORT_LOOK[entry.status];
        return (
          <li
            key={entry.cv_id}
            className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2"
          >
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">
              {entry.by || "A Master Trainer"}
              {entry.visit_date ? ` · ${entry.visit_date}` : ""}
              {entry.visit_time ? ` at ${entry.visit_time}` : ""}
            </span>

            {entry.media > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200"
                title={`${entry.media} photograph${entry.media === 1 ? "" : "s"} or video`}
              >
                <Camera className="h-3 w-3" />
                {entry.media}
              </span>
            )}

            <span
              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${look.className}`}
            >
              <look.Icon className="h-3 w-3" />
              {look.label}
            </span>

            <button
              disabled={entry.status === "draft"}
              onClick={() => onOpen(entry.cv_id)}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
            >
              View
            </button>
          </li>
        );
      })}
    </ul>
  );
};

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
      className={`rounded-xl border px-4 py-3 text-left transition ${
        active
          ? "border-sky-500 bg-sky-50/50 ring-1 ring-sky-200"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
      }`}
    >
      <p className={`text-2xl font-bold tabular-nums ${tint}`}>{value}</p>
      <p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p>
    </button>
  );
};

const VisitOverview: React.FC = () => {
  const { selectedBatchId, selectedBatchName } = useBatch();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [week, setWeek] = useState<EvalWeek | null>(null);
  const [weeks, setWeeks] = useState<EvalWeek[]>([]);
  const [rows, setRows] = useState<VisitOverviewRow[]>([]);
  const [chased, setChased] = useState(true);
  const [masterTrainers, setMasterTrainers] = useState(0);
  const [summary, setSummary] = useState({
    centers: 0,
    expected: 0,
    done: 0,
    complete: 0,
    partial: 0,
    missing: 0,
  });

  const [weekKey, setWeekKey] = useState<string | undefined>();
  const [filter, setFilter] = useState<"all" | "complete" | "partial" | "missing">("all");
  // Which centres are open. Several at once, because comparing two centres is
  // the reason to open them at all.
  const [expanded, setExpanded] = useState<number[]>([]);

  const [open, setOpen] = useState<{
    visit: CenterVisit;
    questions: VisitQuestion[];
    filedBy: string | null;
    reviewable: boolean;
  } | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [note, setNote] = useState("");

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
      const data = await getVisitOverview(selectedBatchId, weekKey);
      setWeek(data.week);
      setWeeks(data.weeks);
      setRows(data.rows);
      setSummary(data.summary);
      setChased(data.chased !== false);
      setMasterTrainers(data.masterTrainers || 0);
    } catch (caught: any) {
      setError(caught?.response?.data?.message || "Could not load the overview.");
    } finally {
      setLoading(false);
    }
  }, [selectedBatchId, weekKey]);

  useEffect(() => {
    load();
  }, [load]);

  const show = async (cv_id: number) => {
    try {
      const data = await getVisit(cv_id);
      setOpen({
        visit: data.visit,
        questions: data.questions,
        filedBy: data.filed_by,
        reviewable: data.reviewable,
      });
      setNote("");
    } catch {
      toast.error("Could not open that visit.");
    }
  };

  const review = async (reviewed: boolean) => {
    if (!open) return;

    setReviewing(true);
    try {
      const result = await reviewVisit(open.visit.cv_id, { reviewed, note });
      toast.success(result.message);
      setOpen({ ...open, visit: result.visit });
      load();
    } catch (caught: any) {
      toast.error(caught?.response?.data?.message || "Could not review that visit.");
    } finally {
      setReviewing(false);
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

        <VisitReport
          visit={open.visit}
          questions={open.questions}
          filedBy={open.filedBy}
        />

        {open.reviewable && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            {open.visit.cv_status === "reviewed" ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">
                  You marked this reviewed. The Master Trainer can see that.
                </p>
                <button
                  onClick={() => review(false)}
                  disabled={reviewing}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Withdraw review
                </button>
              </div>
            ) : (
              <>
                <label className="text-sm font-medium text-slate-800">
                  Anything to say back?{" "}
                  <span className="font-normal text-slate-400">optional</span>
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="A note the Master Trainer will see with the report"
                  className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={() => review(true)}
                    disabled={reviewing}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {reviewing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <BadgeCheck className="h-4 w-4" />
                    )}
                    Mark as reviewed
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  const visible = rows.filter((row) => (filter === "all" ? true : row.status === filter));

  return (
    <div className="mx-auto max-w-5xl pb-12">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Centre Visits</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Visit Report Proforma
            {selectedBatchName ? ` · ${selectedBatchName}` : ""}
          </p>
        </div>
        {week && (
          <WeekPicker week={week} weeks={weeks} disabled={loading} onChange={setWeekKey} />
        )}
      </div>

      {(!selectedBatchId || selectedBatchId < 0) && !loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <Building2 className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-700">Choose a batch first</p>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat
          label="Centres"
          value={summary.centers}
          tone="slate"
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        <Stat label="Reports filed" value={summary.done} tone="emerald" />
        <Stat
          label="All in"
          value={summary.complete}
          tone="emerald"
          active={filter === "complete"}
          onClick={() => setFilter("complete")}
        />
        <Stat
          label="Some missing"
          value={summary.partial}
          tone="amber"
          active={filter === "partial"}
          onClick={() => setFilter("partial")}
        />
        <Stat
          label={chased ? "Nobody has been" : "On paper"}
          value={summary.missing}
          tone={chased ? "rose" : "slate"}
          active={filter === "missing"}
          onClick={() => setFilter("missing")}
        />
      </div>

      {chased && week && summary.expected > 0 && (
        <p className="mb-4 flex items-center gap-1.5 text-xs text-slate-500">
          <Users className="h-3.5 w-3.5" />
          {summary.done} of {summary.expected} reports in for {describeWeek(week)} —
          {masterTrainers === 1
            ? " one Master Trainer visits"
            : ` each of ${masterTrainers} Master Trainers visits`}{" "}
          every physical centre, and one of them files the Online Cell.
        </p>
      )}

      {chased && week && summary.missing > 0 && filter === "all" && (
        <button
          onClick={() => setFilter("missing")}
          className="mb-4 flex w-full items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-left transition hover:bg-rose-100/60"
        >
          <ShieldAlert className="h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <p className="text-sm font-semibold text-rose-900">
              Nobody went to {summary.missing} of {summary.centers} centres in{" "}
              {describeWeek(week)}
            </p>
            <p className="text-xs text-rose-800">Show only those</p>
          </div>
        </button>
      )}

      {loading && (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
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
            const look = CENTER_LOOK[row.status];
            const open = expanded.includes(row.center_id);

            return (
              <div key={row.center_id} className="border-b border-slate-100 last:border-0">
                <button
                  onClick={() =>
                    setExpanded((current) =>
                      current.includes(row.center_id)
                        ? current.filter((id) => id !== row.center_id)
                        : [...current, row.center_id]
                    )
                  }
                  className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                >
                  <span className="shrink-0 text-slate-400">
                    {open ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </span>

                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${
                      row.online_cell
                        ? "bg-indigo-50 text-indigo-600 ring-indigo-200"
                        : "bg-slate-100 text-slate-500 ring-slate-200"
                    }`}
                  >
                    {row.online_cell ? (
                      <Globe className="h-4 w-4" />
                    ) : (
                      <Building2 className="h-4 w-4" />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {row.center_name}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {row.online_cell
                        ? row.covers.length > 0
                          ? `One report for ${row.covers.join(", ")}`
                          : "Every online and hybrid centre — one report between them"
                        : `${row.done} of ${row.expected} Master Trainer${
                            row.expected === 1 ? "" : "s"
                          } have filed`}
                    </span>
                  </span>

                  <span
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${look.className}`}
                  >
                    <look.Icon className="h-3.5 w-3.5" />
                    {row.online_cell || row.expected === 1
                      ? look.label
                      : `${row.done}/${row.expected}`}
                  </span>
                </button>

                {open && <Filed visits={row.visits} onOpen={show} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default VisitOverview;
