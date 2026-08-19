import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Mail, Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { EmailCampaign, getEmailCampaigns } from "../../services/api";
import { useBatch } from "../../context/BatchContext";
import { isRole, ROLE } from "../../utils/roles";
import SettingsHeader from "../Settings/SettingsHeader";
import CampaignForm from "./CampaignForm";
import CampaignDetail from "./CampaignDetail";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  running: "bg-emerald-100 text-emerald-800",
  paused: "bg-amber-100 text-amber-800",
  completed: "bg-sky-100 text-sky-800",
  cancelled: "bg-rose-100 text-rose-800",
};

/**
 * Email campaign console.
 *
 * SuperAdmin only. The server enforces the same on every endpoint, so this
 * check only decides whether the screen is worth rendering - it is not the
 * security boundary.
 */
const EmailCampaigns: React.FC = () => {
  const { userType, selectedBatchId } = useBatch();
  const canManage = isRole(userType, ROLE.SUPER_ADMIN);

  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "create">("list");
  const [openCampaignId, setOpenCampaignId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await getEmailCampaigns();
      setCampaigns(response.campaigns || []);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          (error instanceof Error ? error.message : "Could not load campaigns")
      );
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    load();
  }, [load]);

  // Several campaigns can be sending at once, so keep the list fresh while any
  // of them is still running.
  useEffect(() => {
    if (!campaigns.some((c) => c.ec_status === "running")) return;
    const poll = setInterval(load, 30000);
    return () => clearInterval(poll);
  }, [campaigns, load]);

  if (!canManage) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-md rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-amber-600" />
          <h2 className="mt-3 text-lg font-semibold text-amber-900">
            Super Admin only
          </h2>
          <p className="mt-1 text-sm text-amber-800">
            Email campaigns send mail to hundreds of real applicants, so only a
            Super Admin can open this screen.
          </p>
        </div>
      </div>
    );
  }

  if (openCampaignId !== null) {
    return (
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <CampaignDetail
          campaignId={openCampaignId}
          onBack={() => {
            setOpenCampaignId(null);
            load();
          }}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <SettingsHeader
        SettingsHeader="Email Campaigns"
        SettingDescription="Interview call-ups and reminders, sent in paced batches"
      />

      {view === "create" ? (
        <div className="mt-6">
          <CampaignForm
            onCreated={() => {
              setView("list");
              load();
            }}
            onCancel={() => setView("list")}
          />
        </div>
      ) : (
        <>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => setView("create")}
              disabled={!selectedBatchId || selectedBatchId < 0}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-4 w-4" /> New campaign
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading campaigns…
            </div>
          ) : campaigns.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
              <Mail className="mx-auto h-8 w-8 text-slate-400" />
              <h3 className="mt-3 text-base font-semibold text-slate-800">
                No campaigns yet
              </h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                Create one to email interview call-ups to a center's candidates.
                The quota is split evenly across that center's courses, and
                anyone already contacted is skipped automatically.
              </p>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5">Campaign</th>
                    <th className="px-4 py-2.5">Center</th>
                    <th className="px-4 py-2.5">Batch</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Progress</th>
                    <th className="px-4 py-2.5">Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((campaign) => {
                    const stats = campaign.stats;
                    const total = stats?.total || 0;
                    const sent = stats?.sent || 0;
                    const pct = total > 0 ? Math.round((sent / total) * 100) : 0;

                    return (
                      <tr
                        key={campaign.ec_id}
                        onClick={() => setOpenCampaignId(campaign.ec_id)}
                        className="cursor-pointer border-t border-slate-200 hover:bg-slate-50"
                      >
                        <td className="px-4 py-3">
                          <span className="font-medium text-slate-900">
                            {campaign.ec_name}
                          </span>
                          {campaign.ec_kind === "reminder" && (
                            <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">
                              reminder
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {campaign.center?.center_name || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {campaign.batch?.tb_name || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              STATUS_STYLES[campaign.ec_status] || "bg-slate-100"
                            }`}
                          >
                            {campaign.ec_status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-600">
                              {sent}/{total}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {stats?.failed ? (
                            <span className="font-medium text-rose-700">
                              {stats.failed}
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EmailCampaigns;
