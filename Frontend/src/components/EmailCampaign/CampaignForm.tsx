import React, { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Mail,
  Eye,
  Info,
  Download,
  Monitor,
  Smartphone,
  FileCode,
} from "lucide-react";
import { toast } from "sonner";
import {
  CampaignEligibility,
  UploadedRecipient,
  createEmailCampaign,
  downloadCampaignRecipientPreview,
  getCampaignEligibility,
  getCampaignStarterTemplate,
  previewCampaignEmail,
} from "../../services/api";
import { useBatch } from "../../context/BatchContext";
import { useReferenceData } from "../../hooks/useReferenceData";
import RecipientListUpload from "./RecipientListUpload";

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
 * Where a campaign's recipients come from.
 *
 * This is the only choice left on the screen. There used to be a "what are you
 * sending?" selector offering three built-in letters (interview call-up,
 * selection letter, general announcement), each with its own block of
 * interview date/time/venue fields. All of that is gone: every campaign is now
 * the admin's own HTML, sent unchanged to everyone, so the only thing left to
 * decide is who receives it.
 */
type Source = "candidates" | "students" | "list";

const SOURCES: Array<{ value: Source; title: string; note: string }> = [
  {
    value: "candidates",
    title: "Candidates at a center",
    note: "Applicants for this batch who have not been emailed yet.",
  },
  {
    value: "students",
    title: "Enrolled students at a center",
    note: "Students already enrolled at the center for this batch.",
  },
  {
    value: "list",
    title: "Uploaded email list",
    note: "A spreadsheet of addresses you provide.",
  },
];

/**
 * Create one campaign.
 *
 * The body is always custom HTML. An example template loads on open so the
 * editor is never empty and the preview always shows a real message. For the
 * center-based sources the quota is split evenly across that center's courses
 * and anyone already contacted is skipped; for an uploaded list, the file is
 * the list.
 */
const CampaignForm: React.FC<Props> = ({ onCreated, onCancel }) => {
  const { selectedBatchId, selectedBatchName } = useBatch();
  const { centers } = useReferenceData();

  const [source, setSource] = useState<Source>("candidates");
  const isList = source === "list";

  const [centerId, setCenterId] = useState<number>(0);
  const [eligibility, setEligibility] = useState<CampaignEligibility | null>(null);
  const [loadingEligibility, setLoadingEligibility] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [listRecipients, setListRecipients] = useState<UploadedRecipient[]>([]);

  const [form, setForm] = useState({
    ec_name: "",
    ec_target_count: 200,
    ec_batch_size: 25,
    ec_interval_minutes: 15,
    ec_min_gap_seconds: 8,
    ec_max_gap_seconds: 30,
    ec_subject: "A message from the Digibizz Program",
    ec_custom_html: "",
    startNow: false,
  });

  const set = (key: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // The editor is never left empty: there would be nothing to preview, and the
  // server refuses to create a campaign without a body.
  useEffect(() => {
    let cancelled = false;
    getCampaignStarterTemplate()
      .then((result) => {
        if (cancelled) return;
        setForm((prev) =>
          prev.ec_custom_html.trim()
            ? prev
            : { ...prev, ec_custom_html: result.html }
        );
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Could not load the example - write your own HTML");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // An uploaded list has no pool in the database to count against.
    if (isList || !centerId || !selectedBatchId) {
      setEligibility(null);
      return;
    }

    let cancelled = false;
    setLoadingEligibility(true);
    getCampaignEligibility(selectedBatchId, centerId, "general", source)
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
  }, [centerId, selectedBatchId, source, isList]);

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

  /**
   * How many this campaign will actually email.
   *
   * For an uploaded list that is the file's row count, NOT the per-course
   * projection - which is always zero for a list, because a list has no
   * eligibility lookup. Deriving this from the projection alone is exactly why
   * "Create campaign" stayed disabled after a list was uploaded.
   */
  const willSend = isList
    ? listRecipients.length
    : projectedSplit.reduce((sum, b) => sum + b.allocated, 0);

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

  const emailPayload = useMemo(
    () => ({ ...form, ec_kind: "general", ec_audience: source }),
    [form, source]
  );

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const result = await previewCampaignEmail({
        tb_id: selectedBatchId,
        center_id: centerId || undefined,
        ...emailPayload,
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

  // Live preview, debounced so typing HTML does not fire a request per
  // keystroke. Rendered server-side so what is shown is what is sent.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      previewCampaignEmail({
        tb_id: selectedBatchId,
        center_id: centerId || undefined,
        ...emailPayload,
      })
        .then((result) => setPreviewHtml(result.html))
        .catch(() => {
          /* keep the last good preview rather than blanking the pane */
        });
    }, 600);

    return () => window.clearTimeout(timer);
  }, [emailPayload, selectedBatchId, centerId]);

  /** Download exactly who this campaign would contact, before creating it. */
  const handleDownloadList = async () => {
    if (!centerId) {
      toast.error("Choose a center first");
      return;
    }
    if (willSend === 0) {
      toast.error("Nobody is available to contact with these settings");
      return;
    }

    setDownloading(true);
    try {
      await downloadCampaignRecipientPreview(
        selectedBatchId,
        centerId,
        Number(form.ec_target_count) || 0,
        "general",
        source
      );
      toast.success("Recipient list downloaded");
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          (error instanceof Error ? error.message : "Could not build the list")
      );
    } finally {
      setDownloading(false);
    }
  };

  /**
   * Why Create is disabled, in words.
   *
   * Shown beside the button rather than left for the operator to work out. A
   * greyed-out control with no explanation is precisely why this screen was
   * reported as broken.
   */
  const blockedReason = useMemo(() => {
    if (!form.ec_name.trim()) return "Give the campaign a name";
    if (!centerId) return "Choose a center";
    if (!form.ec_subject.trim()) return "Enter a subject";
    if (!form.ec_custom_html.trim()) return "Write the email body";
    if (isList && listRecipients.length === 0) return "Upload an email list";
    if (!isList && loadingEligibility) return "Checking who is available…";
    if (willSend === 0) return "Nobody is available to contact";
    if (Number(form.ec_min_gap_seconds) > Number(form.ec_max_gap_seconds)) {
      return "Minimum gap cannot be greater than the maximum";
    }
    return null;
  }, [
    form.ec_name,
    form.ec_subject,
    form.ec_custom_html,
    form.ec_min_gap_seconds,
    form.ec_max_gap_seconds,
    centerId,
    isList,
    listRecipients.length,
    loadingEligibility,
    willSend,
  ]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (blockedReason) {
      toast.error(blockedReason);
      return;
    }

    setSaving(true);
    try {
      const response = await createEmailCampaign({
        ...emailPayload,
        tb_id: selectedBatchId,
        center_id: centerId,
        ...(isList ? { recipientList: listRecipients } : {}),
      });

      if (response?.success) {
        const test = response.test;
        const testNote = test?.sent?.length
          ? ` A test copy went to ${test.sent.join(" and ")}.`
          : test?.failed?.length
          ? " The test copy could not be sent - check SMTP."
          : "";
        toast.success((response.message || "Campaign created") + testNote);
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
        <h3 className="text-base font-semibold text-slate-900">Send to</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          {SOURCES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSource(option.value)}
              className={`rounded-md border p-3 text-left transition-colors ${
                source === option.value
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span className="block text-sm font-semibold text-slate-900">
                {option.title}
              </span>
              <span className="mt-1 block text-xs text-slate-600">
                {option.note}
              </span>
            </button>
          ))}
        </div>
      </div>

      {isList ? (
        <RecipientListUpload
          recipients={listRecipients}
          onChange={setListRecipients}
        />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-base font-semibold text-slate-900">
            Who to contact
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {source === "students" ? "Enrolled students" : "Applications"} for{" "}
            <strong>{selectedBatchName || "the selected batch"}</strong>. Anyone
            already emailed by an earlier campaign for this center is skipped
            automatically.
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
                      <tr
                        key={row.course_id}
                        className="border-t border-slate-200"
                      >
                        <td className="py-1.5 text-slate-800">
                          {row.course_full_name || row.course_name}
                        </td>
                        <td className="py-1.5 text-slate-600">
                          {row.available}
                        </td>
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
                  Only {willSend} are still available, so that is what will be
                  queued.
                </p>
              )}

              <button
                type="button"
                onClick={handleDownloadList}
                disabled={downloading || willSend === 0}
                className="mt-4 inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download these {willSend} recipients (CSV)
              </button>
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-900">Campaign</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            label="Campaign name"
            hint="Shown only to staff, so you can find it later."
          >
            <input
              type="text"
              value={form.ec_name}
              onChange={(e) => set("ec_name", e.target.value)}
              placeholder={
                centerName ? `${centerName} announcement` : "Campaign name"
              }
              className={inputClass}
            />
          </Field>
          <Field label="Subject" hint="The subject line recipients see.">
            <input
              type="text"
              value={form.ec_subject}
              onChange={(e) => set("ec_subject", e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      {/* Preview left, editor right. The preview is what gets checked, so it
          gets the space; the editor only needs to be readable. */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Email body
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Your HTML is sent exactly as written — the same message to every
              recipient.
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (
                form.ec_custom_html.trim() &&
                !window.confirm("Replace what you have written?")
              ) {
                return;
              }
              try {
                const result = await getCampaignStarterTemplate();
                set("ec_custom_html", result.html);
                toast.success("Example template loaded");
              } catch {
                toast.error("Could not load the example");
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <FileCode className="h-3.5 w-3.5" /> Load example
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="order-1">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Live preview
              </span>
              <div className="inline-flex rounded-md border border-slate-300 p-0.5">
                <button
                  type="button"
                  onClick={() => setDevice("desktop")}
                  aria-pressed={device === "desktop"}
                  className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    device === "desktop"
                      ? "bg-slate-800 text-white"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5" /> Desktop
                </button>
                <button
                  type="button"
                  onClick={() => setDevice("mobile")}
                  aria-pressed={device === "mobile"}
                  className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    device === "mobile"
                      ? "bg-slate-800 text-white"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" /> Mobile
                </button>
              </div>
            </div>

            <div className="flex justify-center rounded-md border border-slate-200 bg-slate-100 p-3">
              {!form.ec_custom_html.trim() ? (
                <div className="flex h-[560px] w-full items-center justify-center px-6 text-center text-sm text-slate-500">
                  The body is empty. Write some HTML, or load the example.
                </div>
              ) : previewHtml ? (
                <iframe
                  title="Email preview"
                  srcDoc={previewHtml}
                  // No allow-* flags: nothing in pasted markup should be able
                  // to run inside the admin console.
                  sandbox=""
                  style={{ width: device === "mobile" ? 390 : "100%" }}
                  className="h-[560px] max-w-full rounded border border-slate-300 bg-white transition-[width] duration-200"
                />
              ) : (
                <div className="flex h-[560px] w-full items-center justify-center text-sm text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rendering
                  preview…
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Rendered by the server, so this is exactly what a recipient
              receives.
            </p>
          </div>

          <div className="order-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Your HTML
            </label>
            <textarea
              value={form.ec_custom_html}
              onChange={(e) => set("ec_custom_html", e.target.value)}
              spellCheck={false}
              placeholder={
                '<div style="font-family:Arial,sans-serif">\n  <h2>Dear Applicant,</h2>\n  <p>Your message here.</p>\n</div>'
              }
              className="mt-1.5 h-[520px] w-full rounded-md border border-slate-300 p-3 font-mono text-xs leading-relaxed outline-none focus:border-emerald-500"
            />
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
              onChange={(e) =>
                set("ec_interval_minutes", Number(e.target.value))
              }
              className={inputClass}
            />
          </Field>
          <Field label="Min gap (seconds)">
            <input
              type="number"
              min={0}
              value={form.ec_min_gap_seconds}
              onChange={(e) =>
                set("ec_min_gap_seconds", Number(e.target.value))
              }
              className={inputClass}
            />
          </Field>
          <Field label="Max gap (seconds)">
            <input
              type="number"
              min={0}
              value={form.ec_max_gap_seconds}
              onChange={(e) =>
                set("ec_max_gap_seconds", Number(e.target.value))
              }
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

      <div className="flex flex-wrap items-center justify-end gap-3">
        {blockedReason && (
          <span className="mr-auto flex items-center gap-1.5 text-xs text-amber-700">
            <Info className="h-3.5 w-3.5 shrink-0" />
            {blockedReason}
          </span>
        )}
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
          disabled={saving || Boolean(blockedReason)}
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
