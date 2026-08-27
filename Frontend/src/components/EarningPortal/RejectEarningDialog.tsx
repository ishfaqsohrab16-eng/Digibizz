import React, { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

interface Props {
  /** The submission being rejected; null closes the dialog. */
  submission: { earningId: number; studentName?: string; platform?: string; amount?: string | number } | null;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}

/** Long enough to say something useful, short enough to stay a reason. */
const MIN_REASON = 10;
const MAX_REASON = 1000;

/**
 * Collects the reason before a submission is rejected.
 *
 * The reason is mandatory rather than optional because the student sees it:
 * "rejected" on its own tells them nothing they can act on, so they resubmit
 * the same proof and it is rejected again. The server enforces this too - this
 * dialog only saves the round-trip.
 */
const RejectEarningDialog: React.FC<Props> = ({ submission, onCancel, onConfirm }) => {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setReason("");
    setSaving(false);
  }, [submission?.earningId]);

  if (!submission) return null;

  const trimmed = reason.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_REASON;
  const canReject = trimmed.length >= MIN_REASON && trimmed.length <= MAX_REASON && !saving;

  const handleConfirm = async () => {
    if (!canReject) return;
    setSaving(true);
    try {
      await onConfirm(trimmed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-start gap-3 border-b border-slate-200 p-5">
          <div className="rounded-full bg-rose-100 p-2">
            <AlertTriangle className="h-5 w-5 text-rose-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Reject this submission?
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {submission.studentName || "This student"} will see the reason you
              give.
            </p>
          </div>
        </div>

        <div className="space-y-4 p-5">
          {(submission.platform || submission.amount) && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              {submission.platform}
              {submission.platform && submission.amount ? " · " : ""}
              {submission.amount ? `$${submission.amount}` : ""}
            </div>
          )}

          <div>
            <label
              htmlFor="reject-reason"
              className="block text-sm font-medium text-slate-700"
            >
              Reason for rejection
            </label>
            <textarea
              id="reject-reason"
              rows={4}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={MAX_REASON}
              autoFocus
              placeholder="For example: the screenshot does not show the client payment, or the amount does not match the proof."
              className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm outline-none ${
                tooShort
                  ? "border-rose-400 focus:border-rose-500"
                  : "border-slate-300 focus:border-emerald-500"
              }`}
            />
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className={tooShort ? "text-rose-600" : "text-slate-500"}>
                {tooShort
                  ? `Please write at least ${MIN_REASON} characters so the student can act on it.`
                  : "Explain what is wrong so the student can fix it and resubmit."}
              </span>
              <span className="text-slate-400">
                {trimmed.length}/{MAX_REASON}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canReject}
            className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Rejecting…" : "Reject submission"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RejectEarningDialog;
