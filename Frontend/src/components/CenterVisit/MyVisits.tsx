import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  Camera,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileEdit,
  Globe,
  Loader2,
  Lock,
} from "lucide-react";
import { EvalWeek, VisitCenter, getVisitCenters } from "../../services/api";
import { useBatch } from "../../context/BatchContext";
import WeekPicker, { describeWeek } from "../WeeklyEvaluation/WeekPicker";
import VisitForm from "./VisitForm";

/**
 * The centres a Master Trainer has to visit this week.
 *
 * Organised around the one question they have on a Monday morning: where do I
 * still need to go. So unvisited centres come first, and a centre a colleague
 * has already covered says who went rather than merely disappearing - two
 * people setting off to the same place is exactly what this list prevents.
 *
 * The Online Cell sits at the end, marked as what it is: one entry standing
 * for every online and hybrid centre, filed once by whoever gets to it.
 */

type View = { name: "list" } | { name: "form"; centerId: number };

const StatusPill: React.FC<{
  status: "draft" | "submitted" | "reviewed";
  mine: boolean;
}> = ({ status, mine }) => {
  const look = {
    reviewed: {
      className: "bg-emerald-600 text-white ring-emerald-600",
      label: "Reviewed",
      Icon: BadgeCheck,
    },
    submitted: {
      className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
      label: "Visited",
      Icon: CheckCircle2,
    },
    draft: {
      className: "bg-amber-50 text-amber-800 ring-amber-200",
      label: mine ? "Draft saved" : "Being written",
      Icon: FileEdit,
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

const MyVisits: React.FC = () => {
  const { selectedBatchId, selectedBatchName } = useBatch();

  const [view, setView] = useState<View>({ name: "list" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [week, setWeek] = useState<EvalWeek | null>(null);
  const [weeks, setWeeks] = useState<EvalWeek[]>([]);
  const [centers, setCenters] = useState<VisitCenter[]>([]);
  const [weekKey, setWeekKey] = useState<string | undefined>();

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
      const data = await getVisitCenters(selectedBatchId, weekKey);
      setWeek(data.week);
      setWeeks(data.weeks);
      setCenters(data.centers);
    } catch (caught: any) {
      setError(caught?.response?.data?.message || "Could not load the centres.");
    } finally {
      setLoading(false);
    }
  }, [selectedBatchId, weekKey]);

  useEffect(() => {
    if (view.name === "list") load();
  }, [load, view.name]);

  if (view.name === "form") {
    return (
      <VisitForm
        tb_id={selectedBatchId}
        centerId={view.centerId}
        weekKey={week?.key}
        onBack={() => setView({ name: "list" })}
      />
    );
  }

  const outstanding = centers.filter(
    (center) => !["submitted", "reviewed"].includes(center.visit?.status || "")
  ).length;

  return (
    <div className="mx-auto max-w-4xl pb-12">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Weekly Centre Visits</h1>
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
          <p className="mt-1 text-xs text-slate-500">
            Which centres need visiting depends on where that batch has classes running.
          </p>
        </div>
      )}

      {!loading && !error && week && centers.length > 0 && (
        <div
          className={`mb-4 flex items-start gap-3 rounded-xl border p-4 ${
            outstanding > 0 ? "border-sky-200 bg-sky-50" : "border-emerald-200 bg-emerald-50"
          }`}
        >
          {outstanding > 0 ? (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          )}
          <div>
            <p
              className={`text-sm font-semibold ${
                outstanding > 0 ? "text-sky-900" : "text-emerald-900"
              }`}
            >
              {outstanding > 0
                ? `${outstanding} centre${outstanding === 1 ? "" : "s"} still to visit for ${describeWeek(week)}`
                : `Every centre has been visited for ${describeWeek(week)}`}
            </p>
            <p
              className={`mt-0.5 text-xs ${outstanding > 0 ? "text-sky-800" : "text-emerald-800"}`}
            >
              One report per centre — if a colleague has already been, it shows here.
            </p>
          </div>
        </div>
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

      {!loading && !error && selectedBatchId > 0 && centers.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <Building2 className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-700">
            No centre had a class running this week
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Centres appear here once a class is allocated and their own dates cover the week.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {centers
          .slice()
          .sort((a, b) => {
            // Unvisited first: this is a list of where to go. The Online Cell
            // stays last within each group, being a different kind of thing.
            const done = (entry: VisitCenter) =>
              ["submitted", "reviewed"].includes(entry.visit?.status || "") ? 1 : 0;
            return (
              done(a) - done(b) ||
              Number(a.online_cell) - Number(b.online_cell) ||
              a.center_name.localeCompare(b.center_name)
            );
          })
          .map((center) => {
            const visit = center.visit;
            // Somebody else's draft is not something to walk into.
            const locked = Boolean(visit) && !visit!.mine && visit!.status !== "draft";
            const theirDraft = Boolean(visit) && !visit!.mine && visit!.status === "draft";

            return (
              <div
                key={center.center_id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-sky-300 hover:shadow-sm"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${
                    center.online_cell
                      ? "bg-indigo-50 text-indigo-600 ring-indigo-200"
                      : "bg-slate-100 text-slate-500 ring-slate-200"
                  }`}
                >
                  {center.online_cell ? (
                    <Globe className="h-5 w-5" />
                  ) : (
                    <Building2 className="h-5 w-5" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{center.center_name}</p>
                    {visit ? (
                      <StatusPill status={visit.status} mine={visit.mine} />
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Not visited
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    {center.online_cell
                      ? "Every online and hybrid centre — one report between them"
                      : center.medium}
                    {visit?.by && !visit.mine ? ` · filed by ${visit.by}` : ""}
                    {visit?.visit_date ? ` · visited ${visit.visit_date}` : ""}
                    {visit?.media ? ` · ${visit.media} file${visit.media === 1 ? "" : "s"}` : ""}
                  </p>
                </div>

                <button
                  onClick={() => setView({ name: "form", centerId: center.center_id })}
                  disabled={theirDraft}
                  title={
                    theirDraft
                      ? `${visit?.by || "Another Master Trainer"} is filling this in`
                      : undefined
                  }
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    locked || theirDraft
                      ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      : "bg-sky-600 text-white shadow-sm hover:bg-sky-700"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {theirDraft ? (
                    <Lock className="h-3.5 w-3.5" />
                  ) : locked ? (
                    <ClipboardList className="h-3.5 w-3.5" />
                  ) : (
                    <Camera className="h-3.5 w-3.5" />
                  )}
                  {locked
                    ? "View"
                    : theirDraft
                      ? "In progress"
                      : visit?.status === "draft"
                        ? "Continue"
                        : "Fill in"}
                  {!theirDraft && <ChevronRight className="h-3.5 w-3.5" />}
                </button>
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default MyVisits;
