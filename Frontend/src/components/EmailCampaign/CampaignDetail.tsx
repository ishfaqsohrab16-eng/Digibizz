import React, { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Pause,
  Play,
  Send,
  BellRing,
  XCircle,
  Download,
  FlaskConical,
} from "lucide-react";
import { toast } from "sonner";
import ReminderDialog from "./ReminderDialog";
import {
  CampaignStats,
  EmailCampaign,
  createCampaignReminder,
  downloadCampaignRecipients,
  getCampaignRecipients,
  getEmailCampaign,
  sendCampaignChunkNow,
  sendCampaignTest,
  setCampaignStatus,
} from "../../services/api";

interface Props {
  campaignId: number;
  onBack: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  running: "bg-emerald-100 text-emerald-800",
  paused: "bg-amber-100 text-amber-800",
  completed: "bg-sky-100 text-sky-800",
  cancelled: "bg-rose-100 text-rose-800",
};

const RECIPIENT_STATUS_STYLES: Record<string, string> = {
  pending: "text-slate-500",
  sent: "text-emerald-700",
  failed: "text-rose-700",
  skipped: "text-slate-400",
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
};

const Stat: React.FC<{ label: string; value: React.ReactNode; tone?: string }> = ({
  label,
  value,
  tone = "text-slate-900",
}) => (
  <div className="rounded-md border border-slate-200 bg-white p-3">
    <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
    <p className={`mt-1 text-xl font-bold ${tone}`}>{value}</p>
  </div>
);

/**
 * Progress and controls for one campaign.
 *
 * The reminder button is the important one: it creates a second campaign
 * targeting only the people this one actually delivered to who still have no
 * interview recorded, so nobody who already attended is chased again.
 */
const CampaignDetail: React.FC<Props> = ({ campaignId, onBack }) => {
  const [campaign, setCampaign] = useState<EmailCampaign | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [perCourse, setPerCourse] = useState<
    Array<{ course_id: number; course_name: string; total: number; sent: number }>
  >([]);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // A reminder asks for the rescheduled date/time/venue first - see
  // ReminderDialog for why silently reusing the original is dangerous.
  const [remindOpen, setRemindOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [detail, recipientPage] = await Promise.all([
        getEmailCampaign(campaignId),
        getCampaignRecipients(campaignId, {
          pageSize: 100,
          status: statusFilter || undefined,
        }),
      ]);
      setCampaign(detail.campaign);
      setStats(detail.stats);
      setPerCourse(detail.perCourse || []);
      setRecipients(recipientPage.recipients || []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not load the campaign"
      );
    } finally {
      setLoading(false);
    }
  }, [campaignId, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // A running campaign changes underneath the page as chunks go out.
  useEffect(() => {
    if (campaign?.ec_status !== "running") return;
    const poll = setInterval(load, 30000);
    return () => clearInterval(poll);
  }, [campaign?.ec_status, load]);

  const act = async (fn: () => Promise<any>, successMessage?: string) => {
    setBusy(true);
    try {
      const response = await fn();
      if (response?.success === false) {
        toast.error(response?.message || "That did not work");
      } else if (successMessage || response?.message) {
        toast.success(response?.message || successMessage);
      }
      await load();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          (error instanceof Error ? error.message : "That did not work")
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading campaign…
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="py-20 text-center text-slate-500">
        Campaign not found.
        <button onClick={onBack} className="ml-2 text-emerald-700 underline">
          Go back
        </button>
      </div>
    );
  }

  const progress =
    stats && stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0;
  const isActive = campaign.ec_status === "running";
  const canResume =
    campaign.ec_status === "draft" || campaign.ec_status === "paused";

  return (
    <div className="space-y-6">
      <ReminderDialog
        campaign={remindOpen ? campaign : null}
        onCancel={() => setRemindOpen(false)}
        onConfirm={async (payload) => {
          await act(() => createCampaignReminder(campaign.ec_id, payload));
          setRemindOpen(false);
        }}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="mb-2 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" /> All campaigns
          </button>
          <h2 className="text-xl font-bold text-slate-900">{campaign.ec_name}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {campaign.center?.center_name} · {campaign.batch?.tb_name} ·{" "}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                STATUS_STYLES[campaign.ec_status] || "bg-slate-100"
              }`}
            >
              {campaign.ec_status}
            </span>
            {campaign.ec_kind === "reminder" && (
              <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">
                reminder
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Available in every state: the list is worth keeping as a record
              long after the campaign has finished. */}
          <button
            onClick={async () => {
              try {
                await downloadCampaignRecipients(campaign.ec_id);
              } catch {
                toast.error("Could not download the list");
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" /> Download list
          </button>
          <button
            onClick={() => act(() => sendCampaignTest(campaign.ec_id))}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <FlaskConical className="h-4 w-4" /> Send test copy
          </button>
          {canResume && (
            <button
              onClick={() =>
                act(() => setCampaignStatus(campaign.ec_id, "start"), "Campaign started")
              }
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Play className="h-4 w-4" /> Start
            </button>
          )}
          {isActive && (
            <button
              onClick={() =>
                act(() => setCampaignStatus(campaign.ec_id, "pause"), "Campaign paused")
              }
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Pause className="h-4 w-4" /> Pause
            </button>
          )}
          {campaign.ec_status !== "completed" &&
            campaign.ec_status !== "cancelled" && (
              <>
                <button
                  onClick={() => act(() => sendCampaignChunkNow(campaign.ec_id))}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Send next chunk now
                </button>
                <button
                  onClick={() =>
                    act(
                      () => setCampaignStatus(campaign.ec_id, "cancel"),
                      "Campaign cancelled"
                    )
                  }
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" /> Cancel
                </button>
              </>
            )}
          {campaign.ec_kind === "initial" && (stats?.sent || 0) > 0 && (
            <button
              onClick={() => setRemindOpen(true)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              <BellRing className="h-4 w-4" /> Remind those not interviewed
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Queued" value={stats?.total ?? 0} />
        <Stat label="Sent" value={stats?.sent ?? 0} tone="text-emerald-700" />
        <Stat label="Pending" value={stats?.pending ?? 0} tone="text-slate-600" />
        <Stat label="Failed" value={stats?.failed ?? 0} tone="text-rose-700" />
        <Stat label="Skipped" value={stats?.skipped ?? 0} tone="text-slate-400" />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">Progress</span>
          <span className="text-slate-500">{progress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex justify-between">
            <dt className="text-slate-500">Pace</dt>
            <dd className="font-medium text-slate-800">
              {campaign.ec_batch_size} per ~{campaign.ec_interval_minutes} min
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Gap between emails</dt>
            <dd className="font-medium text-slate-800">
              {campaign.ec_min_gap_seconds}–{campaign.ec_max_gap_seconds}s random
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Last chunk</dt>
            <dd className="font-medium text-slate-800">
              {formatDateTime(campaign.ec_last_run_at)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Next chunk</dt>
            <dd className="font-medium text-slate-800">
              {isActive ? formatDateTime(campaign.ec_next_run_at) : "—"}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Interview</dt>
            <dd className="font-medium text-slate-800">
              {campaign.ec_interview_date || "—"} {campaign.ec_interview_time || ""}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Venue</dt>
            <dd className="max-w-[60%] truncate text-right font-medium text-slate-800">
              {campaign.ec_venue || "—"}
            </dd>
          </div>
        </dl>
      </div>

      {perCourse.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-base font-semibold text-slate-900">
            Split by course
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-1">Course</th>
                <th className="py-1">Queued</th>
                <th className="py-1">Sent</th>
              </tr>
            </thead>
            <tbody>
              {perCourse.map((row) => (
                <tr key={row.course_id} className="border-t border-slate-200">
                  <td className="py-1.5 text-slate-800">{row.course_name}</td>
                  <td className="py-1.5 text-slate-600">{row.total}</td>
                  <td className="py-1.5 font-semibold text-emerald-700">
                    {row.sent}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">Recipients</h3>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-1.5">Name</th>
                <th className="py-1.5">Email</th>
                <th className="py-1.5">Course</th>
                <th className="py-1.5">Status</th>
                <th className="py-1.5">Sent at</th>
                <th className="py-1.5">Interviewed</th>
              </tr>
            </thead>
            <tbody>
              {recipients.map((row) => {
                const marks = row.candidate?.cand_interview_marks;
                const interviewed =
                  (marks && marks !== "TBD" && marks !== "") ||
                  (row.candidate?.interview_date &&
                    row.candidate.interview_date !== "");
                return (
                  <tr key={row.ecr_id} className="border-t border-slate-200">
                    <td className="py-1.5 text-slate-800">{row.ecr_name || "—"}</td>
                    <td className="py-1.5 text-slate-600">{row.ecr_email}</td>
                    <td className="py-1.5 text-slate-600">
                      {row.course?.course_full_name || row.course?.course_name || "—"}
                    </td>
                    <td
                      className={`py-1.5 font-medium ${
                        RECIPIENT_STATUS_STYLES[row.ecr_status] || ""
                      }`}
                      title={row.ecr_error || ""}
                    >
                      {row.ecr_status}
                      {row.ecr_status === "failed" && row.ecr_error ? " ⚠" : ""}
                    </td>
                    <td className="py-1.5 text-slate-500">
                      {formatDateTime(row.ecr_sent_at)}
                    </td>
                    <td className="py-1.5">
                      {interviewed ? (
                        <span className="text-emerald-700">Yes</span>
                      ) : (
                        <span className="text-slate-400">No</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {recipients.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    No recipients match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CampaignDetail;
