import React from "react";
import { BadgeCheck, Building2, Camera, Check, Globe, X } from "lucide-react";
import { CenterVisit, VisitQuestion } from "../../services/api";

/**
 * A submitted visit, read back.
 *
 * The same questions in the same order, without the inputs, and with the
 * photographs the Master Trainer brought back - which are the part that turns
 * a page of ticks into evidence somebody was actually there.
 */

const mediaUrl = (file: string) =>
  `${import.meta.env.VITE_BACKEND_URL || ""}/uploads/center-visits/${file}`;

interface Props {
  visit: CenterVisit;
  questions: VisitQuestion[];
  filedBy?: string | null;
}

const VisitReport: React.FC<Props> = ({ visit, questions, filedBy }) => {
  const media = visit.cv_media || [];
  const isOnlineCell = visit.cv_center_id === 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-inset ${
              isOnlineCell
                ? "bg-indigo-50 text-indigo-600 ring-indigo-200"
                : "bg-slate-100 text-slate-500 ring-slate-200"
            }`}
          >
            {isOnlineCell ? <Globe className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">{visit.cv_center_name}</p>
            <p className="text-xs text-slate-500">
              {visit.cv_week_start} to {visit.cv_week_end}
              {filedBy ? ` · ${filedBy}` : ""}
            </p>
          </div>
        </div>

        {(visit.cv_visit_date || visit.cv_visit_time) && (
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900">{visit.cv_visit_date}</p>
            {visit.cv_visit_time && (
              <p className="text-xs text-slate-500">{visit.cv_visit_time}</p>
            )}
          </div>
        )}
      </div>

      {visit.cv_status === "reviewed" && (
        <div className="flex items-start gap-2.5 border-b border-emerald-100 bg-emerald-50 px-5 py-3">
          <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-emerald-900">
              Reviewed{visit.cv_reviewed_by_name ? ` by ${visit.cv_reviewed_by_name}` : ""}
              {visit.cv_reviewed_on
                ? ` on ${new Date(visit.cv_reviewed_on).toLocaleDateString()}`
                : ""}
            </p>
            {visit.cv_review_note && (
              <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-800">
                {visit.cv_review_note}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {questions.map((question) => {
          const entry = visit.cv_answers?.[question.key];
          const yes = entry?.answer === "Yes";
          const no = entry?.answer === "No";

          return (
            <div key={question.key} className="flex items-start gap-3 px-5 py-3">
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                  yes
                    ? "bg-emerald-100 text-emerald-700"
                    : no
                      ? "bg-rose-100 text-rose-700"
                      : "bg-slate-100 text-slate-300"
                }`}
              >
                {yes ? (
                  <Check className="h-3.5 w-3.5" />
                ) : no ? (
                  <X className="h-3.5 w-3.5" />
                ) : (
                  <span className="text-xs">—</span>
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800">{question.label}</p>
                {/* The reason, which is the part somebody can act on. */}
                {entry?.note && (
                  <p className="mt-0.5 text-sm text-slate-500">{entry.note}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {visit.cv_remarks && (
        <div className="border-t border-slate-100 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Overall remarks for this centre
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{visit.cv_remarks}</p>
        </div>
      )}

      {media.length > 0 && (
        <div className="border-t border-slate-100 px-5 py-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Camera className="h-3.5 w-3.5" />
            From the visit
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {media.map((item) => (
              <div
                key={item.file}
                className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
              >
                {item.type === "video" ? (
                  <video
                    src={mediaUrl(item.file)}
                    controls
                    className="h-28 w-full bg-black object-cover"
                  />
                ) : (
                  <a href={mediaUrl(item.file)} target="_blank" rel="noreferrer">
                    <img
                      src={mediaUrl(item.file)}
                      alt="From the visit"
                      className="h-28 w-full object-cover transition hover:opacity-90"
                    />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {visit.cv_submitted_on && (
        <p className="border-t border-slate-100 px-5 py-2.5 text-[11px] text-slate-400">
          Filed {new Date(visit.cv_submitted_on).toLocaleString()}
        </p>
      )}
    </div>
  );
};

export default VisitReport;
