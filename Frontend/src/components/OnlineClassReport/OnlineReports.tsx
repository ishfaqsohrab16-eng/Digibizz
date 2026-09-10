import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileEdit,
  Globe,
  Loader2,
  Lock,
  PenLine,
} from "lucide-react";
import { EvalWeek, OnlineReportRow, getOnlineReports } from "../../services/api";
import { useBatch } from "../../context/BatchContext";
import WeekPicker, { describeWeek } from "../WeeklyEvaluation/WeekPicker";
import OnlineReportForm from "./OnlineReportForm";
import OnlineReportView from "./OnlineReportView";

/**
 * Every online and hybrid centre for one week, and where its Online Classes
 * Report stands.
 *
 * One screen for both audiences. A Master Trainer sees which centres still
 * need a report and which a colleague already has - one report per centre,
 * so a centre somebody else has started is shown as theirs rather than
 * offered again. An admin sees which centres nobody reported on, which is the
 * question that changes anyone's behaviour.
 */

type View =
  | { name: "list" }
  | { name: "form"; centerId: number }
  | { name: "view"; ocrId: number };

const STATUS = {
  reviewed: {
    label: "Reviewed",
    className: "bg-emerald-600 text-white ring-emerald-600",
    Icon: BadgeCheck,
  },
  submitted: {
    label: "Submitted",
    className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    Icon: CheckCircle2,
  },
  draft: {
    label: "Being written",
    className: "bg-amber-50 text-amber-800 ring-amber-200",
    Icon: FileEdit,
  },
  missing: {
    label: "Not reported",
    className: "bg-rose-50 text-rose-700 ring-rose-200",
    Icon: AlertTriangle,
  },
} as const;

const OnlineReports: React.FC = () => {
  const { selectedBatchId, selectedBatchName } = useBatch();

  const [view, setView] = useState<View>({ name: "list" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [week, setWeek] = useState<EvalWeek | null>(null);
  const [weeks, setWeeks] = useState<EvalWeek[]>([]);
  const [weekKey, setWeekKey] = useState<string | undefined>();
  const [rows, setRows] = useState<OnlineReportRow[]>([]);
  const [chased, setChased] = useState(true);
  const [isMasterTrainer, setIsMasterTrainer] = useState(false);
  const [summary, setSummary] = useState({
    centers: 0,
    submitted: 0,
    reviewed: 0,
    draft: 0,
    missing: 0,
  });

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
      const data = await getOnlineReports(selectedBatchId, weekKey);
      setWeek(data.week);
      setWeeks(data.weeks);
      setRows(data.rows);
      setSummary(data.summary);
      setChased(data.chased !== false);
      setIsMasterTrainer(Boolean(data.isMasterTrainer));
    } catch (caught: any) {
      setError(caught?.response?.data?.message || "Could not load the online centres.");
    } finally {
      setLoading(false);
    }
  }, [selectedBatchId, weekKey]);

  useEffect(() => {
    if (view.name === "list") load();
  }, [load, view.name]);

  if (view.name === "form") {
    return (
      <OnlineReportForm
        tb_id={selectedBatchId}
        centerId={view.centerId}
        weekKey={week?.key}
        onBack={() => setView({ name: "list" })}
      />
    );
  }

  if (view.name === "view") {
    return <OnlineReportView ocrId={view.ocrId} onBack={() => setView({ name: "list" })} />;
  }

  /** The one button on a row, which depends on who is looking. */
  const action = (row: OnlineReportRow) => {
    if (isMasterTrainer) {
      if (row.status === "missing") {
        return { label: "Fill in", Icon: PenLine, onClick: () => setView({ name: "form", centerId: row.center_id }), primary: true };
      }
      if (row.status === "draft" && row.mine) {
        return { label: "Continue", Icon: FileEdit, onClick: () => setView({ name: "form", centerId: row.center_id }), primary: true };
      }
      if (row.status === "draft") {
        return { label: "In progress", Icon: Lock, onClick: null, primary: false };
      }
    }
    if (row.ocr_id) {
      const ocrId = row.ocr_id;
      return { label: "View", Icon: ClipboardList, onClick: () => setView({ name: "view", ocrId }), primary: false };
    }
    return { label: row.status === "draft" ? "In progress" : "Not filed", Icon: Lock, onClick: null, primary: false };
  };

  return (
    <div className="mx-auto max-w-5xl pb-12">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Online Classes Report</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Online &amp; hybrid centres · one report per centre each week
            {selectedBatchName ? ` · ${selectedBatchName}` : ""}
          </p>
        </div>
        {week && <WeekPicker week={week} weeks={weeks} disabled={loading} onChange={setWeekKey} />}
      </div>

      {(!selectedBatchId || selectedBatchId < 0) && !loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <Globe className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-700">Choose a batch first</p>
        </div>
      )}

      {!loading && !error && week && rows.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Online & hybrid centres", value: summary.centers, tone: "text-slate-900" },
            { label: "Submitted", value: summary.submitted, tone: "text-emerald-700" },
            { label: "Reviewed", value: summary.reviewed, tone: "text-emerald-700" },
            {
              label: chased ? "Not reported" : "On paper",
              value: summary.missing,
              tone: chased ? "text-rose-700" : "text-slate-500",
            },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className={`text-2xl font-bold tabular-nums ${stat.tone}`}>{stat.value}</p>
              <p className="mt-0.5 text-xs font-medium text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && week && isMasterTrainer && rows.some((row) => row.status === "missing") && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
          <p className="text-sm text-sky-900">
            <span className="font-semibold">
              {rows.filter((row) => row.status === "missing").length} centre
              {rows.filter((row) => row.status === "missing").length === 1 ? "" : "s"} still need
              a report for {describeWeek(week)}.
            </span>{" "}
            One report per centre — whoever starts it first files it.
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

      {!loading && !error && selectedBatchId > 0 && rows.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <Globe className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-700">
            No online or hybrid centre had a class running this week
          </p>
          <p className="mt-1 text-xs text-slate-500">
            A centre appears here once it is set to Online or Hybrid, a class is allocated, and its
            own dates cover the week.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {rows.map((row) => {
          const look = STATUS[row.status];
          const button = action(row);
          return (
            <div
              key={row.center_id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:shadow-sm"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-inset ring-indigo-200">
                <Globe className="h-5 w-5" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900">{row.center_name}</p>
                  <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-indigo-700">
                    {row.medium}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${look.className}`}
                  >
                    <look.Icon className="h-3 w-3" />
                    {look.label}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {row.courses.join(" · ") || "No courses allocated"}
                  {row.filed_by ? ` · ${row.mine ? "you" : row.filed_by}` : ""}
                  {row.reviewed_by ? ` · reviewed by ${row.reviewed_by}` : ""}
                </p>
              </div>

              <button
                onClick={button.onClick || undefined}
                disabled={!button.onClick}
                title={
                  !button.onClick && row.filed_by
                    ? `${row.filed_by} is filing this centre's report`
                    : undefined
                }
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  button.primary
                    ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <button.Icon className="h-3.5 w-3.5" />
                {button.label}
                {button.onClick && <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OnlineReports;
