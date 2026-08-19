import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Mail, Eye, Info } from "lucide-react";
import { toast } from "sonner";
import {
  CampaignEligibility,
  createEmailCampaign,
  getCampaignEligibility,
  previewCampaignEmail,
} from "../../services/api";
import { useBatch } from "../../context/BatchContext";
import { useReferenceData } from "../../hooks/useReferenceData";

interface Props {
  onCreated: () => void;
  onCancel: () => void;
}

const Field: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, hint, children }) => (
  <div>
    <label className="block text-sm font-medium text-slate-700">{label}</label>
    {children}
    {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
  </div>
);

const inputClass =
  "mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500";

/**
 * Create one campaign: pick a center, say how many candidates to contact, and
 * the quota is divided evenly across that center's courses.
 *
 * Candidates already contacted by an earlier campaign for the same
 * center+batch are excluded automatically, which is what makes the
 * "200 now, 200 tomorrow, then 100" sequence work without any manual list
 * keeping. The eligibility panel shows exactly how many are still reachable.
 */
const CampaignForm: React.FC<Props> = ({ onCreated, onCancel }) => {
  const { selectedBatchId, selectedBatchName } = useBatch();
  const { centers } = useReferenceData();

  const [centerId, setCenterId] = useState<number>(0);
  const [eligibility, setEligibility] = useState<CampaignEligibility | null>(null);
  const [loadingEligibility, setLoadingEligibility] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const [form, setForm] = useState({
    ec_name: "",
    ec_target_count: 200,
    ec_batch_size: 25,
    ec_interval_minutes: 15,
    ec_min_gap_seconds: 8,
    ec_max_gap_seconds: 30,
    ec_subject: "Interview call | Digibizz Program",
    ec_interview_date: "",
    ec_interview_time: "",
    ec_reporting_time: "",
    ec_venue: "",
    ec_contact_person: "",
    ec_contact_phone: "",
    ec_message: "",
    startNow: false,
  });

  const set = (key: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (!centerId || !selectedBatchId) {
      setEligibility(null);
      return;
    }

    let cancelled = false;
    setLoadingEligibility(true);
    getCampaignEligibility(selectedBatchId, centerId)
      .then((data) => {
        if (!cancelled) setEligibility(data);
      })
      .catch(() => {
        if (!cancelled) setEligibility(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingEligibility(false);
      });

    return () => {
      cancelled = true;
    };
  }, [centerId, selectedBatchId]);

  const centerName = useMemo(
    () => centers.find((c) => c.center_id === centerId)?.center_name || "",
    [centers, centerId]
  );

  /**
   * Mirror of the server's split, purely so the operator can see the plan
   * before committing. The server recomputes it authoritatively on create.
   */
  const projectedSplit = useMemo(() => {
    if (!eligibility) return [];
    const target = Math.max(0, Number(form.ec_target_count) || 0);
    const buckets = eligibility.courses.map((course) => ({
      ...course,
      allocated: 0,
    }));

    let remaining = target;
    let open = buckets.filter((b) => b.available > 0);

    while (remaining > 0 && open.length > 0) {
      const share = Math.floor(remaining / open.length);
      if (share === 0) {
        const ordered = [...open].sort(
          (a, b) => b.available - b.allocated - (a.available - a.allocated)
        );
        for (const bucket of ordered) {
          if (remaining === 0) break;
          if (bucket.allocated >= bucket.available) continue;
          bucket.allocated += 1;
          remaining -= 1;
        }
        break;
      }
      for (const bucket of open) {
        const take = Math.min(share, bucket.available - bucket.allocated);
        bucket.allocated += take;
        remaining -= take;
      }
      open = open.filter((b) => b.available - b.allocated > 0);
    }

    return buckets;
  }, [eligibility, form.ec_target_count]);

  const willSend = projectedSplit.reduce((sum, b) => sum + b.allocated, 0);

  /** Rough wall-clock estimate, using the midpoint of the random gap range. */
  const estimate = useMemo(() => {
    if (willSend === 0) return "";
    const batchSize = Math.max(1, Number(form.ec_batch_size) || 1);
    const chunks = Math.ceil(willSend / batchSize);
    const avgGap =
      (Number(form.ec_min_gap_seconds) + Number(form.ec_max_gap_seconds)) / 2;
    const withinChunk = (batchSize - 1) * avgGap;
    const betweenChunks = (chunks - 1) * Number(form.ec_interval_minutes) * 60;
    const totalMinutes = Math.round((chunks * withinChunk + betweenChunks) / 60);

    if (totalMinutes < 60) return `about ${totalMinutes} min`;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `about ${hours}h ${mins}m`;
  }, [
    willSend,
    form.ec_batch_size,
    form.ec_interval_minutes,
    form.ec_min_gap_seconds,
    form.ec_max_gap_seconds,
  ]);

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const result = await previewCampaignEmail({
        tb_id: selectedBatchId,
        center_id: centerId || undefined,
        ...form,
      });
      setPreviewHtml(result.html);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not render the preview"
      );
    } finally {
      setPreviewing(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!centerId) {
      toast.error("Choose a center first");
      return;
    }
    if (!form.ec_name.trim()) {
      toast.error("Give the campaign a name");
      return;
    }
    if (Number(form.ec_min_gap_seconds) > Number(form.ec_max_gap_seconds)) {
      toast.error("Minimum gap cannot be greater than the maximum gap");
      return;
    }

    setSaving(true);
    try {
      const response = await createEmailCampaign({
        ...form,
        tb_id: selectedBatchId,
        center_id: centerId,
      });
      if (response?.success) {
        toast.success(response.message || "Campaign created");
        onCreated();
      } else {
        toast.error(response?.message || "Could not create the campaign");
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          (error instanceof Error ? error.message : "Could not create the campaign")
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-900">Who to contact</h3>
        <p className="mt-1 text-xs text-slate-500">
          Applications for <strong>{selectedBatchName || "the selected batch"}</strong>.
          Candidates already emailed by an earlier campaign for this center are
          skipped automatically.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Center">
            <select
              value={centerId}
              onChange={(e) => setCenterId(Number(e.target.value))}
              className={inputClass}
            >
              <option value={0}>Select a center</option>
              {centers.map((center) => (
                <option key={center.center_id} value={center.center_id}>
                  {center.center_name}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Campaign name"
            hint="Shown only to staff, e.g. “UoB interview call - round 1”."
          >
            <input
              type="text"
              value={form.ec_name}
              onChange={(e) => set("ec_name", e.target.value)}
              placeholder={centerName ? `${centerName} interview call` : "Campaign name"}
              className={inputClass}
            />
          </Field>

          <Field
            label="How many emails"
            hint="Divided evenly across this center's courses."
          >
            <input
              type="number"
              min={1}
              value={form.ec_target_count}
              onChange={(e) => set("ec_target_count", Number(e.target.value))}
              className={inputClass}
            />
          </Field>
        </div>

        {loadingEligibility && (
          <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking who is still
            reachable…
          </p>
        )}

        {eligibility && !loadingEligibility && (
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <span className="text-slate-700">
                <strong>{eligibility.totalAvailable}</strong> not yet contacted
              </span>
              <span className="text-slate-500">
                {eligibility.alreadyContacted} already contacted
              </span>
              <span className="font-semibold text-emerald-700">
                this campaign will queue {willSend}
              </span>
            </div>

            {projectedSplit.length > 0 && (
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-1">Course</th>
                    <th className="py-1">Available</th>
                    <th className="py-1">Will receive</th>
                  </tr>
                </thead>
                <tbody>
                  {projectedSplit.map((row) => (
                    <tr key={row.course_id} className="border-t border-slate-200">
                      <td className="py-1.5 text-slate-800">
                        {row.course_full_name || row.course_name}
                      </td>
                      <td className="py-1.5 text-slate-600">{row.available}</td>
                      <td className="py-1.5 font-semibold text-slate-900">
                        {row.allocated}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {willSend < Number(form.ec_target_count) && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Only {willSend} candidates are still available, so that is what
                will be queued.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-900">
          Interview details
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          These go into the email. The rest of each message - name, CNIC, course,
          center - comes from the candidate's own application.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Subject">
            <input
              type="text"
              value={form.ec_subject}
              onChange={(e) => set("ec_subject", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Interview date">
            <input
              type="date"
              value={form.ec_interview_date}
              onChange={(e) => set("ec_interview_date", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Interview time">
            <input
              type="text"
              value={form.ec_interview_time}
              onChange={(e) => set("ec_interview_time", e.target.value)}
              placeholder="10:00 AM to 02:00 PM"
              className={inputClass}
            />
          </Field>
          <Field label="Reporting time">
            <input
              type="text"
              value={form.ec_reporting_time}
              onChange={(e) => set("ec_reporting_time", e.target.value)}
              placeholder="09:30 AM"
              className={inputClass}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Venue">
              <input
                type="text"
                value={form.ec_venue}
                onChange={(e) => set("ec_venue", e.target.value)}
                placeholder="Main Campus, University of Balochistan, Quetta"
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Contact person">
            <input
              type="text"
              value={form.ec_contact_person}
              onChange={(e) => set("ec_contact_person", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Contact number">
            <input
              type="text"
              value={form.ec_contact_phone}
              onChange={(e) => set("ec_contact_phone", e.target.value)}
              className={inputClass}
            />
          </Field>
          <div className="md:col-span-2">
            <Field
              label="Extra note (optional)"
              hint="Appears as a highlighted paragraph above the details table."
            >
              <textarea
                rows={3}
                value={form.ec_message}
                onChange={(e) => set("ec_message", e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-900">Sending pace</h3>
        <p className="mt-1 text-xs text-slate-500">
          Messages go out in small chunks with a random pause between each one.
          Both the volume and the irregular rhythm matter: a few hundred emails
          leaving at a steady cadence is what gets a sending domain blocklisted.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Field label="Emails per chunk">
            <input
              type="number"
              min={1}
              value={form.ec_batch_size}
              onChange={(e) => set("ec_batch_size", Number(e.target.value))}
              className={inputClass}
            />
          </Field>
          <Field label="Minutes between chunks">
            <input
              type="number"
              min={1}
              value={form.ec_interval_minutes}
              onChange={(e) => set("ec_interval_minutes", Number(e.target.value))}
              className={inputClass}
            />
          </Field>
          <Field label="Min gap (seconds)">
            <input
              type="number"
              min={0}
              value={form.ec_min_gap_seconds}
              onChange={(e) => set("ec_min_gap_seconds", Number(e.target.value))}
              className={inputClass}
            />
          </Field>
          <Field label="Max gap (seconds)">
            <input
              type="number"
              min={0}
              value={form.ec_max_gap_seconds}
              onChange={(e) => set("ec_max_gap_seconds", Number(e.target.value))}
              className={inputClass}
            />
          </Field>
        </div>

        {estimate && (
          <p className="mt-3 text-sm text-slate-600">
            {willSend} emails will take <strong>{estimate}</strong> to go out,
            with each chunk landing at a slightly different time.
          </p>
        )}

        <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.startNow}
            onChange={(e) => set("startNow", e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Start sending as soon as the campaign is created
        </label>
      </div>

      {previewHtml && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-base font-semibold text-slate-900">
            Email preview
          </h3>
          <iframe
            title="Email preview"
            srcDoc={previewHtml}
            sandbox=""
            className="h-[520px] w-full rounded-md border border-slate-200"
          />
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handlePreview}
          disabled={previewing}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {previewing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
          Preview email
        </button>
        <button
          type="submit"
          disabled={saving || !centerId || willSend === 0}
          className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          Create campaign
        </button>
      </div>
    </form>
  );
};

export default CampaignForm;
