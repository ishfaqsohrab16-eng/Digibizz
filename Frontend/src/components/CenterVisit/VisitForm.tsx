import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Camera,
  CheckCircle2,
  Clock,
  Film,
  Loader2,
  Lock,
  MapPin,
  Save,
  Send,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  CenterVisit,
  VisitAnswer,
  VisitCenter,
  VisitMedia,
  VisitQuestion,
  prepareVisit,
  removeVisitMedia,
  saveVisit,
} from "../../services/api";

/**
 * The Visit Report Proforma, for one centre.
 *
 * The paper lays its questions down the side and the centres across the top,
 * which works on a clipboard and not on a screen: a visit happens at one
 * centre, at one time, with its own photographs. So this is one form per
 * centre, and the questions are what the columns of the paper form share.
 *
 * EVERY ANSWER IS YES, NO, AND A REMARK. The paper leaves a box per cell and
 * people write in it. A bare tick loses the reason, and the reason is the part
 * somebody can act on: "No" is a fact, "No - load-shedding 11am to 1pm daily"
 * is a thing that can be fixed.
 *
 * ONE REPORT PER CENTRE PER WEEK, whoever gets there first. If a colleague has
 * already filed it, this shows what they found rather than hiding it - knowing
 * the centre was covered, and what was seen, is the useful part.
 */

/**
 * Where uploaded media is served from.
 *
 * Built from VITE_BACKEND_URL, as every other component that links to an
 * upload does - app.js serves uploads/ statically, one level above /api.
 */
const mediaUrl = (file: string) =>
  `${import.meta.env.VITE_BACKEND_URL || ""}/uploads/center-visits/${file}`;

interface Props {
  tb_id: number;
  centerId: number;
  weekKey?: string;
  onBack: () => void;
}

const VisitForm: React.FC<Props> = ({ tb_id, centerId, weekKey, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"draft" | "submitted" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [questions, setQuestions] = useState<VisitQuestion[]>([]);
  const [center, setCenter] = useState<VisitCenter | null>(null);
  const [visit, setVisit] = useState<CenterVisit | null>(null);
  const [filedBy, setFiledBy] = useState<string | null>(null);
  const [editable, setEditable] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [week, setWeek] = useState<{ key: string; start: string; end: string } | null>(null);

  const [answers, setAnswers] = useState<Record<string, VisitAnswer>>({});
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");
  const [remarks, setRemarks] = useState("");
  const [staged, setStaged] = useState<File[]>([]);

  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await prepareVisit(tb_id, centerId, weekKey);

      setQuestions(data.questions);
      setCenter(data.center);
      setVisit(data.visit);
      setFiledBy(data.filed_by);
      setEditable(data.editable);
      setClaimed(data.claimed);
      setWeek(data.week);

      const seeded: Record<string, VisitAnswer> = {};
      for (const question of data.questions) {
        seeded[question.key] = data.visit?.cv_answers?.[question.key] || {
          answer: null,
          note: null,
        };
      }
      setAnswers(seeded);

      setVisitDate(data.visit?.cv_visit_date || "");
      setVisitTime(data.visit?.cv_visit_time || "");
      setRemarks(data.visit?.cv_remarks || "");
      setStaged([]);
    } catch (caught: any) {
      setError(caught?.response?.data?.message || "Could not open that visit.");
    } finally {
      setLoading(false);
    }
  }, [tb_id, centerId, weekKey]);

  useEffect(() => {
    load();
  }, [load]);

  const answer = (key: string, value: "Yes" | "No") =>
    setAnswers((previous) => ({
      ...previous,
      [key]: {
        // Tapping the same button again clears it. A misclick on a form that
        // cannot be un-answered is a reason to abandon the whole thing.
        answer: previous[key]?.answer === value ? null : value,
        note: previous[key]?.note ?? null,
      },
    }));

  const note = (key: string, value: string) =>
    setAnswers((previous) => ({
      ...previous,
      [key]: { answer: previous[key]?.answer ?? null, note: value },
    }));

  const submit = async (status: "draft" | "submitted") => {
    if (!week || !center) return;

    if (status === "submitted") {
      const missing = questions.filter((question) => !answers[question.key]?.answer);
      if (missing.length) {
        toast.error(`Still to answer: ${missing.map((q) => q.label).join(", ")}`);
        return;
      }
      if (!visitDate) {
        toast.error("Please give the date of the visit");
        return;
      }
    }

    setSaving(status);
    try {
      const result = await saveVisit({
        tb_id,
        center_id: center.center_id,
        week_key: week.key,
        status,
        answers,
        visit_date: visitDate || null,
        visit_time: visitTime || null,
        remarks: remarks || null,
        media: staged,
      });

      toast.success(result.message);
      if (status === "submitted") onBack();
      else load();
    } catch (caught: any) {
      toast.error(caught?.response?.data?.message || "Could not save that visit.");
    } finally {
      setSaving(null);
    }
  };

  const dropMedia = async (file: string) => {
    if (!visit) return;
    try {
      const result = await removeVisitMedia(visit.cv_id, file);
      setVisit(result.visit);
    } catch {
      toast.error("Could not remove that file.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error || !center) {
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

  const media: VisitMedia[] = visit?.cv_media || [];

  return (
    <div className="mx-auto max-w-3xl pb-24">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
      >
        <ArrowLeft className="h-4 w-4" />
        All centres
      </button>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-gradient-to-r from-sky-600 to-indigo-600 px-6 py-5 text-white">
          <p className="text-xs font-medium uppercase tracking-widest text-sky-100">
            Visit Report Proforma
          </p>
          <h1 className="mt-0.5 flex items-center gap-2 text-xl font-bold">
            {center.online_cell ? "Online Cell" : center.center_name}
          </h1>
          {week && (
            <p className="mt-0.5 text-sm text-sky-100">
              Week of {week.start} to {week.end}
            </p>
          )}
        </div>

        {/* Somebody else got there first. Shown rather than hidden: knowing the
            centre was covered, and what they found, is the useful part. */}
        {claimed && (
          <div className="flex items-start gap-2.5 border-b border-amber-200 bg-amber-50 px-5 py-3">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-900">
              <span className="font-semibold">{filedBy || "Another Master Trainer"}</span> has
              already filed this week&rsquo;s visit to this centre. One report per centre per
              week — this is what they found.
            </p>
          </div>
        )}

        {visit?.cv_status === "reviewed" && (
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

        {/* When the visit happened. Separate from the week, because the answers
            depend on it - "was there electricity" is about one afternoon. */}
        <div className="grid gap-4 border-b border-slate-200 bg-slate-50/70 px-6 py-4 sm:grid-cols-2">
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <MapPin className="h-3 w-3" />
              Date of Visit
            </label>
            <input
              type="date"
              value={visitDate}
              disabled={!editable}
              onChange={(event) => setVisitDate(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <Clock className="h-3 w-3" />
              Time of Visit
            </label>
            <input
              type="time"
              value={visitTime}
              disabled={!editable}
              onChange={(event) => setVisitTime(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100"
            />
          </div>
        </div>

        {/* The questions. Yes, No, and the box people write in. */}
        <div className="divide-y divide-slate-100">
          {questions.map((question) => {
            const current = answers[question.key];
            return (
              <div key={question.key} className="px-5 py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 text-sm font-medium text-slate-800">
                    {question.label}
                  </p>

                  <div className="flex shrink-0 gap-1.5">
                    {(["Yes", "No"] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        disabled={!editable}
                        onClick={() => answer(question.key, option)}
                        className={`w-14 rounded-lg py-1.5 text-xs font-semibold transition ${
                          current?.answer === option
                            ? option === "Yes"
                              ? "bg-emerald-600 text-white shadow-sm"
                              : "bg-rose-500 text-white shadow-sm"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        } ${!editable ? "cursor-default opacity-80" : ""}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                {/* The small box beside each row on the paper. Always there,
                    because the reason matters most on the answers that are
                    only one word. */}
                <input
                  value={current?.note || ""}
                  disabled={!editable}
                  onChange={(event) => note(question.key, event.target.value)}
                  placeholder="Remarks (optional)"
                  maxLength={500}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:text-slate-500"
                />
              </div>
            );
          })}
        </div>

        {/* Overall remarks for the centre, at the foot of the form. */}
        <div className="border-t border-slate-200">
          <div className="bg-slate-100 px-6 py-2.5">
            <h2 className="text-sm font-semibold text-slate-800">
              Overall remarks for this centre
            </h2>
          </div>
          <div className="px-5 py-3">
            <textarea
              rows={4}
              value={remarks}
              disabled={!editable}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="Anything about the centre as a whole"
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50"
            />
          </div>
        </div>

        {/* Photographs and video: the evidence somebody actually went. */}
        <div className="border-t border-slate-200">
          <div className="flex items-center gap-2 bg-slate-100 px-6 py-2.5">
            <Camera className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-800">Photographs &amp; video</h2>
          </div>

          <div className="px-5 py-4">
            {media.length === 0 && staged.length === 0 && (
              <p className="text-sm text-slate-500">
                {editable
                  ? "Attach at least one photograph from the visit."
                  : "Nothing was attached."}
              </p>
            )}

            {media.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {media.map((item) => (
                  <div
                    key={item.file}
                    className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
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
                          className="h-28 w-full object-cover transition group-hover:opacity-90"
                        />
                      </a>
                    )}

                    {editable && (
                      <button
                        type="button"
                        onClick={() => dropMedia(item.file)}
                        title="Remove"
                        className="absolute right-1 top-1 rounded-md bg-white/90 p-1 text-rose-600 opacity-0 shadow transition group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Chosen but not yet uploaded. Named so somebody can tell what
                they picked before they commit to sending it. */}
            {staged.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {staged.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-1.5 text-xs text-sky-900 ring-1 ring-inset ring-sky-200"
                  >
                    {file.type.startsWith("video") ? (
                      <Film className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <Camera className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <span className="shrink-0 tabular-nums text-sky-700">
                      {(file.size / (1024 * 1024)).toFixed(1)} MB
                    </span>
                    <button
                      type="button"
                      onClick={() => setStaged(staged.filter((_, i) => i !== index))}
                      className="shrink-0 text-sky-700 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <p className="text-[11px] text-slate-500">
                  These upload when you save.
                </p>
              </div>
            )}

            {editable && (
              <>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    const chosen = Array.from(event.target.files || []);
                    setStaged((previous) => [...previous, ...chosen].slice(0, 10));
                    // Cleared so choosing the same file twice still fires.
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-sky-400 hover:bg-sky-50"
                >
                  <Upload className="h-4 w-4" />
                  Add photographs or video
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {editable && (
        <div className="sticky bottom-0 z-20 mt-4 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
          <p className="mr-auto text-xs text-slate-500">
            A draft is yours alone. Submitting files the visit for this centre.
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
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-50"
          >
            {saving === "submitted" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Submit visit
          </button>
        </div>
      )}

      {!editable && visit?.cv_status !== "draft" && (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-500">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          Filed{filedBy ? ` by ${filedBy}` : ""}
          {visit?.cv_submitted_on
            ? ` on ${new Date(visit.cv_submitted_on).toLocaleDateString()}`
            : ""}
        </p>
      )}
    </div>
  );
};

export default VisitForm;
