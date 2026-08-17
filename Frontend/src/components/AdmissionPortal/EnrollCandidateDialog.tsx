import React from "react";
import { GraduationCap, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  EnrollmentPreview,
  enrollCandidate,
  getEnrollmentPreview,
} from "../../services/api";

interface Props {
  candId: number | null;
  onClose: () => void;
  onEnrolled: () => void;
}

const Row: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="flex justify-between gap-4 border-b border-slate-100 py-2 last:border-b-0">
    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
      {label}
    </span>
    <span className="text-right text-sm font-semibold text-slate-800">
      {value || "—"}
    </span>
  </div>
);

/**
 * Confirmation popup shown before enrolling a recommended candidate.
 *
 * Displays the center, course and batch the student will be enrolled into,
 * taken from the candidate's own application. The roll number is generated
 * server-side using the existing DB<batch>-<7 digits>-<checksum> scheme, so it
 * can be checked for uniqueness against the database.
 */
const EnrollCandidateDialog: React.FC<Props> = ({ candId, onClose, onEnrolled }) => {
  const [preview, setPreview] = React.useState<EnrollmentPreview | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [enrolling, setEnrolling] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!candId) {
      setPreview(null);
      setError(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getEnrollmentPreview(candId);
        if (!cancelled) setPreview(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load candidate details");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [candId]);

  if (!candId) return null;

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      const response = await enrollCandidate(candId);
      if (response?.success) {
        toast.success(
          `Enrolled as ${response.student?.std_rollno || "a new student"}`
        );
        onEnrolled();
        onClose();
      } else {
        toast.error(response?.message || "Could not enrol this candidate");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not enrol this candidate");
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-start gap-3 border-b border-slate-200 p-5">
          <div className="rounded-full bg-emerald-100 p-2">
            <GraduationCap className="h-5 w-5 text-emerald-700" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Enrol this candidate</h3>
            <p className="mt-0.5 text-sm text-slate-600">
              Confirm the details below before enrolling.
            </p>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-5">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          )}

          {!loading && error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {error}
            </div>
          )}

          {!loading && !error && preview && (
            <>
              {preview.alreadyEnrolled && (
                <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                  <p className="text-xs text-amber-900">
                    Already enrolled as{" "}
                    <strong>{preview.alreadyEnrolled.std_rollno}</strong>. Enrolling again
                    is not possible.
                  </p>
                </div>
              )}

              {!preview.alreadyEnrolled && preview.candidate.recommended !== "Yes" && (
                <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                  <p className="text-xs text-amber-900">
                    This candidate has not been recommended at interview, so they cannot
                    be enrolled.
                  </p>
                </div>
              )}

              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Candidate
              </p>
              <div className="mb-4 rounded-md border border-slate-200 px-3">
                <Row label="Name" value={preview.candidate.name} />
                <Row label="Father's name" value={preview.candidate.father_name} />
                <Row label="CNIC" value={preview.candidate.cnic} />
                <Row label="Email" value={preview.candidate.email} />
                <Row label="Phone" value={preview.candidate.phone} />
                <Row label="Gender" value={preview.candidate.gender} />
                {preview.candidate.is_uob_student !== null && (
                  <Row
                    label="UoB student"
                    value={preview.candidate.is_uob_student ? "Yes" : "No"}
                  />
                )}
              </div>

              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Will be enrolled into
              </p>
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3">
                <Row label="Center" value={preview.enrollment.center_name} />
                <Row label="Course" value={preview.enrollment.course_name} />
                <Row label="Batch" value={preview.enrollment.batch_name} />
                <Row label="Roll number" value="Generated automatically" />
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                An LMS account will be created and a welcome email sent to{" "}
                {preview.candidate.email}. The student sets their own password on first
                login.
              </p>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={enrolling}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleEnroll}
            disabled={!preview?.eligible || enrolling || loading}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {enrolling && <Loader2 className="h-4 w-4 animate-spin" />}
            {enrolling ? "Enrolling…" : "Confirm enrollment"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnrollCandidateDialog;
