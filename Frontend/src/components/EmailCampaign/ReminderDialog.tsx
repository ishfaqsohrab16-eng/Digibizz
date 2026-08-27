import React, { useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { EmailCampaign } from "../../services/api";

interface Props {
  /** The campaign being chased; null closes the dialog. */
  campaign: EmailCampaign | null;
  onCancel: () => void;
  onConfirm: (payload: Record<string, unknown>) => Promise<void> | void;
}

const inputClass =
  "mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500";

/**
 * Asks for the new date, time and venue before a reminder goes out.
 *
 * A reminder is usually sent BECAUSE the sitting was rescheduled, so silently
 * repeating the original date would send several hundred people to a room on a
 * day nothing is happening. Left blank the fields fall back to the original
 * campaign's, which is the right behaviour for a plain "you did not attend"
 * chase - so the choice is explicit either way.
 */
const ReminderDialog: React.FC<Props> = ({ campaign, onCancel, onConfirm }) => {
  const [form, setForm] = useState({
    ec_interview_date: "",
    ec_interview_time: "",
    ec_reporting_time: "",
    ec_venue: "",
    ec_message: "",
    startNow: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      ec_interview_date: "",
      ec_interview_time: "",
      ec_reporting_time: "",
      ec_venue: "",
      ec_message: "",
      startNow: false,
    });
    setSaving(false);
  }, [campaign?.ec_id]);

  if (!campaign) return null;

  const set = (key: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const rescheduled = Boolean(
    form.ec_interview_date || form.ec_interview_time || form.ec_venue
  );

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-start gap-3 border-b border-slate-200 p-5">
          <div className="rounded-full bg-violet-100 p-2">
            <BellRing className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Remind those not interviewed
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Goes only to people this campaign actually delivered to who still
              have no interview recorded.
            </p>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            If the sitting has been rescheduled, enter the new details below.
            Anything left blank keeps what the original campaign said
            {campaign.ec_interview_date
              ? ` (currently ${campaign.ec_interview_date}${
                  campaign.ec_interview_time ? `, ${campaign.ec_interview_time}` : ""
                })`
              : ""}
            .
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                New date
              </label>
              <input
                type="date"
                value={form.ec_interview_date}
                onChange={(e) => set("ec_interview_date", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                New time
              </label>
              <input
                type="text"
                value={form.ec_interview_time}
                onChange={(e) => set("ec_interview_time", e.target.value)}
                placeholder={campaign.ec_interview_time || "10:00 AM to 02:00 PM"}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                New reporting time
              </label>
              <input
                type="text"
                value={form.ec_reporting_time}
                onChange={(e) => set("ec_reporting_time", e.target.value)}
                placeholder={campaign.ec_reporting_time || "09:30 AM"}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                New venue
              </label>
              <input
                type="text"
                value={form.ec_venue}
                onChange={(e) => set("ec_venue", e.target.value)}
                placeholder={campaign.ec_venue || "Same as before"}
                className={inputClass}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">
                Note (optional)
              </label>
              <textarea
                rows={2}
                value={form.ec_message}
                onChange={(e) => set("ec_message", e.target.value)}
                placeholder="For example: the interview has been moved to a new date."
                className={inputClass}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.startNow}
              onChange={(e) => set("startNow", e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Start sending as soon as the reminder is created
          </label>
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
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {rescheduled ? "Create rescheduled reminder" : "Create reminder"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReminderDialog;
