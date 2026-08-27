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
import RecipientListUpload from "./RecipientListUpload";
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

const MERGE_TOKENS = [
  "name",
  "father_name",
  "cnic",
  "phone",
  "course",
  "center",
  "batch",
  "interview_date",
  "interview_time",
  "reporting_time",
  "venue",
  "contact_person",
  "contact_phone",
  "message",
];

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
  const [downloading, setDownloading] = useState(false);
  // "template" = the built-in interview letter, "custom" = the admin's own HTML.
  const [bodyMode, setBodyMode] = useState<"template" | "custom">("template");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewOf, setPreviewOf] = useState<{ name: string } | null>(null);

  /**
   * What this campaign is. It decides which letter is sent, who is eligible,
   * and what the date/time/venue fields mean.
   *
   * A recommendation always goes to enrolled STUDENTS, never to candidates:
   * "you have been selected" reaching someone who was not selected is the one
   * mistake worth designing out. The server pins this too.
   */
  const [kind, setKind] = useState<
    "initial" | "recommendation" | "general" | "list"
  >("initial");

  // "list" is a kind in the UI but an AUDIENCE on the server: the message type
  // is still a general announcement, only the recipients come from a file.
  const isList = kind === "list";
  const serverKind = isList ? "general" : kind;
  const audience = isList
    ? "list"
    : kind === "recommendation"
    ? "students"
    : "candidates";

  const [listRecipients, setListRecipients] = useState<UploadedRecipient[]>([]);

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
    ec_custom_html: "",
    startNow: false,
  });

  const set = (key: string, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    // An uploaded list has no pool in the database to count against, so the
    // eligibility panel does not apply to it.
    if (isList || !centerId || !selectedBatchId) {
      setEligibility(null);
      return;
    }

    let cancelled = false;
    setLoadingEligibility(true);
    getCampaignEligibility(selectedBatchId, centerId, kind, audience)
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
    // Re-run on kind: a recommendation counts enrolled students, an interview
    // call-up counts candidates, so the availability figures differ entirely.
  }, [centerId, selectedBatchId, kind, audience, isList]);

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

  /**
   * What the server will actually render.
   *
   * Custom HTML is only sent when that mode is selected, so switching back to
   * the built-in letter really does fall back to it rather than leaving
   * orphaned markup in the box still driving the email.
   */
  const emailPayload = useMemo(
    () => ({
      ...form,
      ec_kind: serverKind,
      ec_audience: audience,
      ec_custom_html: bodyMode === "custom" ? form.ec_custom_html : "",
    }),
    [form, bodyMode, serverKind, audience]
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
      setPreviewOf(result.previewOf || null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not render the preview"
      );
    } finally {
      setPreviewing(false);
    }
  };

  // Live preview. Debounced so typing HTML does not fire a request per
  // keystroke, and rendered server-side so what is shown is the same output
  // the recipient gets - a local approximation could drift from it.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      previewCampaignEmail({
        tb_id: selectedBatchId,
        center_id: centerId || undefined,
        ...emailPayload,
      })
        .then((result) => {
          setPreviewHtml(result.html);
          setPreviewOf(result.previewOf || null);
        })
        .catch(() => {
          /* keep the last good preview rather than blanking the pane */
        });
    }, 600);

    return () => window.clearTimeout(timer);
  }, [emailPayload, selectedBatchId, centerId]);

  /**
   * Switching to Custom HTML with an empty box used to preview the BUILT-IN
   * letter, because an empty template falls back to it server-side - so the
   * toggle said "Custom HTML" while the pane showed the pre-built email.
   * Loading the starter on the first switch means the box is never empty.
   */
  const chooseBodyMode = async (mode: "template" | "custom") => {
    setBodyMode(mode);
    if (mode !== "custom" || form.ec_custom_html.trim()) return;

    try {
      const result = await getCampaignStarterTemplate();
      set("ec_custom_html", result.html);
    } catch {
      toast.error("Could not load the starter template - write your own HTML");
    }
  };

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
        kind,
        audience
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
    if (isList && listRecipients.length === 0) {
      toast.error("Upload an email list first");
      return;
    }
    if (Number(form.ec_min_gap_seconds) > Number(form.ec_max_gap_seconds)) {
      toast.error("Minimum gap cannot be greater than the maximum gap");
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
      {/* What this campaign is. Chosen first because it decides who is
          eligible and what the date/time/venue fields below mean. */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-900">
          What are you sending?
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          {(
            [
              {
                value: "initial",
                title: "Interview call-up",
                note: "To candidates who have not been emailed yet for this center.",
              },
              {
                value: "recommendation",
                title: "Selection letter",
                note: "To enrolled students, with the class start date, timing and venue.",
              },
              {
                value: "general",
                title: "General announcement",
                note: "Any other message. Write your own HTML for the body.",
              },
              {
                value: "list",
                title: "Upload an email list",
                note: "One message to every address in a spreadsheet you provide.",
              },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setKind(option.value)}
              className={`rounded-md border p-3 text-left transition-colors ${
                kind === option.value
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

        {isList && (
          <p className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800">
            The same message goes to every address in the file. Sending is paced
            exactly as for any other campaign — chunks, intervals and the random
            gaps you set below.
          </p>
        )}

        {kind === "recommendation" && (
          <p className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800">
            Goes to <strong>enrolled students</strong> at this center — never to
            candidates. Anyone already sent this letter is skipped, so students
            who enrol later can simply be sent it in a follow-up campaign.
          </p>
        )}
      </div>

      {isList ? (
        <RecipientListUpload
          recipients={listRecipients}
          onChange={setListRecipients}
        />
      ) : (
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-900">Who to contact</h3>
        <p className="mt-1 text-xs text-slate-500">
          {audience === "students" ? "Enrolled students" : "Applications"} for{" "}
          <strong>{selectedBatchName || "the selected batch"}</strong>. Anyone
          already emailed by an earlier campaign of this type for this center is
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

            {/* Check the actual list before anything is sent. Built by the same
                selection the create path uses, so it is not an approximation. */}
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
        <h3 className="text-base font-semibold text-slate-900">
          {kind === "recommendation" ? "Class details" : "Interview details"}
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          You enter these at send time; they go straight into the email. The
          rest of each message - name, CNIC, course, center - comes from the
          recipient's own record.
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
          <Field label={kind === "recommendation" ? "Classes begin" : "Interview date"}>
            <input
              type="date"
              value={form.ec_interview_date}
              onChange={(e) => set("ec_interview_date", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label={kind === "recommendation" ? "Class timing" : "Interview time"}>
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
            <Field label={kind === "recommendation" ? "Class venue" : "Venue"}>
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

      {/* Compose: preview on the left, editor on the right. The preview is the
          bigger half because it is what gets checked; the editor only needs to
          be wide enough to read a line of HTML. */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Email body
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Use the built-in interview letter, or write your own HTML.
            </p>
          </div>

          <div className="inline-flex rounded-md border border-slate-300 p-0.5">
            <button
              type="button"
              onClick={() => chooseBodyMode("template")}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                bodyMode === "template"
                  ? "bg-emerald-600 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Built-in letter
            </button>
            <button
              type="button"
              onClick={() => chooseBodyMode("custom")}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                bodyMode === "custom"
                  ? "bg-emerald-600 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              Custom HTML
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Preview - left */}
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
                  title="Desktop width"
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
                  title="Mobile width"
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
              {bodyMode === "custom" && !form.ec_custom_html.trim() ? (
                <div className="flex h-[560px] w-full items-center justify-center px-6 text-center text-sm text-slate-500">
                  Your HTML box is empty. Write some HTML or load the starter
                  template — until then there is nothing to preview.
                </div>
              ) : previewHtml ? (
                <iframe
                  title="Email preview"
                  srcDoc={previewHtml}
                  // Sandboxed with no allow-* flags: nothing in an author's
                  // pasted markup should be able to run inside the console.
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
              {bodyMode === "custom"
                ? "Your HTML, rendered by the server"
                : "The built-in letter, rendered by the server"}
              {previewOf
                ? ` for ${previewOf.name} — the first person on this campaign's list.`
                : " using sample data."}
            </p>
          </div>

          {/* Editor - right */}
          <div className="order-2">
            {bodyMode === "custom" ? (
              <>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Your HTML
                  </label>
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
                        toast.success("Starter template loaded");
                      } catch {
                        toast.error("Could not load the starter template");
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <FileCode className="h-3.5 w-3.5" /> Load starter template
                  </button>
                </div>
                <textarea
                  value={form.ec_custom_html}
                  onChange={(e) => set("ec_custom_html", e.target.value)}
                  spellCheck={false}
                  placeholder={
                    "<div style=\"font-family:Arial,sans-serif\">\n  <h2>Dear {{name}},</h2>\n  <p>Your interview for {{course}} at {{center}} is on {{interview_date}}.</p>\n  <p>Venue: {{venue}}</p>\n</div>"
                  }
                  className="mt-1.5 h-[420px] w-full rounded-md border border-slate-300 p-3 font-mono text-xs leading-relaxed outline-none focus:border-emerald-500"
                />
                <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-700">
                    Merge tokens
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Replaced per recipient. Unknown tokens become blank.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {MERGE_TOKENS.map((token) => (
                      <button
                        key={token}
                        type="button"
                        onClick={() =>
                          set("ec_custom_html", `${form.ec_custom_html}{{${token}}}`)
                        }
                        title="Click to append"
                        className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-700 hover:border-emerald-500 hover:text-emerald-700"
                      >
                        {`{{${token}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-800">
                  Built-in interview letter
                </p>
                <p className="mt-1.5 text-xs text-slate-600">
                  Personalised per recipient from their own application — name,
                  father's name, masked CNIC, phone, course and center — plus the
                  interview details you entered above. Nothing to write.
                </p>
                <ul className="mt-3 space-y-1 text-xs text-slate-600">
                  <li>• Includes the "please bring with you" checklist</li>
                  <li>• Reminder campaigns get their own wording automatically</li>
                  <li>• Switch to Custom HTML to replace it entirely</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>


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
