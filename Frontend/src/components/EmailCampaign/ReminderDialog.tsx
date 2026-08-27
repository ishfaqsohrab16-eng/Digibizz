import React, { useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { EmailCampaign } from "../../services/api";

interface Props {
  /** The campaign being chased; null closes the dialog. */
  campaign: EmailCampaign | null;
  onCancel: () => void;
  onConfirm: (payload: Record<string, unknown>) => Promise<void> | void;
}

/**
 * Confirm before re-sending a campaign to the people who have not responded.
 *
 * This used to collect a rescheduled date, time and venue, because the message
 * was built from a template that rendered them. Bodies are now the admin's own
 * HTML, sent exactly as written, so those fields could not change a single
 * character of what arrives - collecting them would have been theatre. The
 * reminder re-sends this campaign's own message to the narrower list; to say
 * something different, write a new campaign.
 */
const ReminderDialog: React.FC<Props> = ({ campaign, onCancel, onConfirm }) => {
  const [startNow, setStartNow] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStartNow(false);
    setSaving(false);
  }, [campaign?.ec_id]);

  if (!campaign) return null;

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm({ startNow });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-start gap-3 border-b border-slate-200 p-5">
          <div className="rounded-full bg-violet-100 p-2">
            <BellRing className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Send a reminder
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Goes only to people this campaign actually delivered to who still
              have no interview recorded.
            </p>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-medium text-slate-800">{campaign.ec_name}</p>
            <p className="mt-0.5 text-slate-600">{campaign.ec_subject}</p>
          </div>

          <p className="text-xs text-slate-600">
            The same message is sent again, unchanged. If you need to say
            something different — a new date, a new venue — create a new
            campaign instead.
          </p>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={startNow}
              onChange={(e) => setStartNow(e.target.checked)}
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
            Create reminder
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReminderDialog;
