import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  EvalWeek,
  OnlineClassReport,
  OnlineCourseAttendance,
  OnlineQuestion,
  getOnlineReport,
  reviewOnlineReport,
} from "../../services/api";
import { PrintButton } from "../print/PrintSheet";
import OnlineReportCard from "./OnlineReportCard";
import OnlineReportPrint from "./OnlineReportPrint";

/**
 * One filed Online Classes Report, for anybody allowed to read it - with the
 * Super Admin's review underneath, and a Print button.
 *
 * The review changes nothing the report says. It is the second signature on
 * the paper form: somebody senior read it, and the Master Trainer can see
 * that they did.
 */
interface Props {
  ocrId: number;
  onBack: () => void;
}

interface Loaded {
  report: OnlineClassReport;
  questions: OnlineQuestion[];
  attendance: OnlineCourseAttendance[];
  filed_by: string | null;
  week: EvalWeek | null;
  reviewable: boolean;
}

const OnlineReportView: React.FC<Props> = ({ ocrId, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Loaded | null>(null);
  const [note, setNote] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await getOnlineReport(ocrId);
      setData(loaded);
    } catch (caught: any) {
      setError(caught?.response?.data?.message || "Could not open this report.");
    } finally {
      setLoading(false);
    }
  }, [ocrId]);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (reviewed: boolean) => {
    if (!data) return;
    setReviewing(true);
    try {
      const result = await reviewOnlineReport(ocrId, { reviewed, note });
      toast.success(result.message);
      setData({ ...data, report: result.report });
      setNote("");
    } catch (caught: any) {
      toast.error(caught?.response?.data?.message || "Could not review this report.");
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl pb-12">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to the centres
        </button>

        {data && (
          <PrintButton
            render={() => (
              <OnlineReportPrint
                report={data.report}
                questions={data.questions}
                attendance={data.attendance}
                filedBy={data.filed_by}
                week={data.week}
              />
            )}
          />
        )}
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

      {data && !loading && (
        <>
          <OnlineReportCard
            report={data.report}
            questions={data.questions}
            attendance={data.attendance}
            filedBy={data.filed_by}
            week={data.week}
          />

          {data.reviewable && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              {data.report.ocr_status === "reviewed" ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-slate-600">
                    Marked reviewed. The Master Trainer can see that.
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
                    className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
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
        </>
      )}
    </div>
  );
};

export default OnlineReportView;
