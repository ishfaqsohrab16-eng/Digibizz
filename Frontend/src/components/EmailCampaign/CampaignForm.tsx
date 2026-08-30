import React, { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Mail,
  Eye,
  Info,
  Monitor,
  Smartphone,
  FileCode,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import {
  UploadedRecipient,
  createEmailCampaign,
  getCampaignStarterTemplate,
  previewCampaignEmail,
} from "../../services/api";
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
 * Create one campaign.
 *
 * A campaign is four things: a name, a subject, one piece of HTML, and a list
 * of addresses from a spreadsheet. There is nothing else to choose.
 *
 * It used to be an admissions tool - pick a center and a batch, pick whether
 * you are mailing candidates or enrolled students, pick one of three built-in
 * letters, fill in interview date/time/venue fields, and the server would
 * resolve who to send to and personalise each copy with merge tokens. All of
 * that is gone. The operator writes the email, uploads the addresses, and every
 * recipient receives byte-identical markup.
 *
 * That last point is why there is no "preview as" control: with nothing
 * substituted per person, the preview IS the message, for everyone.
 */
const CampaignForm: React.FC<Props> = ({ onCreated, onCancel }) => {
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [recipients, setRecipients] = useState<UploadedRecipient[]>([]);
  const [starterHtml, setStarterHtml] = useState("");

  const [form, setForm] = useState({
    ec_name: "",
    ec_subject: "A message from the Digibizz Program",
    ec_custom_html: "",
    ec_batch_size: 25,
    ec_interval_minutes: 15,
    ec_min_gap_seconds: 8,
    ec_max_gap_seconds: 30,
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
        setStarterHtml(result.html || "");
        setForm((prev) =>
          prev.ec_custom_html.trim()
            ? prev
            : { ...prev, ec_custom_html: result.html || "" }
        );
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Could not load the example — write your own HTML");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Roughly how long the whole send will take.
   *
   * Chunks are `ec_batch_size` messages `ec_interval_minutes` apart, and inside
   * a chunk each message waits a random gap. Shown because the pacing numbers
   * are otherwise abstract - "25 every 15 minutes" does not obviously mean six
   * hours for a list of six hundred.
   */
  const estimate = useMemo(() => {
    const total = recipients.length;
    if (!total) return "";

    const batchSize = Math.max(1, Number(form.ec_batch_size) || 1);
    const chunks = Math.ceil(total / batchSize);
    const avgGap =
      (Number(form.ec_min_gap_seconds) + Number(form.ec_max_gap_seconds)) / 2 ||
      0;
    const withinChunk = (batchSize - 1) * avgGap;
    const betweenChunks =
      (chunks - 1) * Math.max(1, Number(form.ec_interval_minutes) || 1) * 60;
    const seconds = chunks * withinChunk + betweenChunks;

    if (seconds < 90) return "under 2 min";
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `about ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `about ${hours} hr ${rest} min` : `about ${hours} hr`;
  }, [
    recipients.length,
    form.ec_batch_size,
    form.ec_interval_minutes,
    form.ec_min_gap_seconds,
    form.ec_max_gap_seconds,
  ]);

  const handlePreview = async () => {
    if (!form.ec_custom_html.trim()) {
      toast.error("Write the email body first");
      return;
    }
    setPreviewing(true);
    try {
      const result = await previewCampaignEmail({
        ec_subject: form.ec_subject,
        ec_custom_html: form.ec_custom_html,
      });
      setPreviewHtml(result.html);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Could not render the preview"
      );
    } finally {
      setPreviewing(false);
    }
  };

  /** Why the Create button is disabled, or "" when it is not. */
  const blocker = useMemo(() => {
    if (!form.ec_name.trim()) return "Name the campaign";
    if (!form.ec_subject.trim()) return "Write a subject";
    if (!form.ec_custom_html.trim()) return "Write the email body";
    if (recipients.length === 0) return "Upload an email list";
    return "";
  }, [form.ec_name, form.ec_subject, form.ec_custom_html, recipients.length]);

  const handleSubmit = async () => {
    if (blocker) {
      toast.error(blocker);
      return;
    }

    setSaving(true);
    try {
      const result = await createEmailCampaign({
        ec_name: form.ec_name.trim(),
        ec_subject: form.ec_subject.trim(),
        ec_custom_html: form.ec_custom_html,
        ec_batch_size: Number(form.ec_batch_size),
        ec_interval_minutes: Number(form.ec_interval_minutes),
        ec_min_gap_seconds: Number(form.ec_min_gap_seconds),
        ec_max_gap_seconds: Number(form.ec_max_gap_seconds),
        recipientList: recipients,
        startNow: form.startNow,
      });
      toast.success(result.message || "Campaign created");
      onCreated();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Could not create the campaign"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* ---------------------------------------------------------------- */}
      {/* Basics                                                            */}
      {/* ---------------------------------------------------------------- */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-900">Campaign</h3>
        <p className="mt-1 text-xs text-slate-500">
          The name is for your own reference and is never shown to recipients.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Campaign name">
            <input
              className={inputClass}
              value={form.ec_name}
              onChange={(e) => set("ec_name", e.target.value)}
              placeholder="e.g. Orientation announcement — March"
            />
          </Field>
          <Field label="Subject" hint="What recipients see in their inbox.">
            <input
              className={inputClass}
              value={form.ec_subject}
              onChange={(e) => set("ec_subject", e.target.value)}
            />
          </Field>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Recipients                                                        */}
      {/* ---------------------------------------------------------------- */}
      <RecipientListUpload recipients={recipients} onChange={setRecipients} />

      {/* ---------------------------------------------------------------- */}
      {/* Body                                                              */}
      {/* ---------------------------------------------------------------- */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Email body
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Paste or write the HTML. Everyone on the list receives exactly
              this — nothing is filled in per person.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {starterHtml && (
              <button
                type="button"
                onClick={() => {
                  set("ec_custom_html", starterHtml);
                  setPreviewHtml(null);
                  toast.success("Example template restored");
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset to example
              </button>
            )}
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewing}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {previewing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
              Preview
            </button>
          </div>
        </div>

        <div className="mt-4">
          <textarea
            className="h-72 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-emerald-500"
            value={form.ec_custom_html}
            onChange={(e) => {
              set("ec_custom_html", e.target.value);
              // The preview is stale the moment the body changes; leaving it on
              // screen would invite sending against a stale render.
              setPreviewHtml(null);
            }}
            spellCheck={false}
            placeholder="<div>Your email…</div>"
          />
        </div>

        <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
          <FileCode className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Use tables and inline styles — Outlook ignores{" "}
            <code className="rounded bg-slate-100 px-1">&lt;style&gt;</code>{" "}
            blocks. Avoid images, scripts and tracking pixels; they push mail
            into spam.
          </span>
        </p>

        {previewHtml && (
          <div className="mt-4 rounded-md border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-xs font-medium text-slate-600">
                Preview — this is what every recipient receives
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setDevice("desktop")}
                  className={`rounded p-1.5 ${
                    device === "desktop"
                      ? "bg-white text-emerald-600 shadow-sm"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                  title="Desktop width"
                >
                  <Monitor className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDevice("mobile")}
                  className={`rounded p-1.5 ${
                    device === "mobile"
                      ? "bg-white text-emerald-600 shadow-sm"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                  title="Mobile width"
                >
                  <Smartphone className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="flex justify-center bg-slate-100 p-3">
              {/* Sandboxed: campaign HTML is author-written and trusted enough
                  to render, but it must not be able to run script or navigate
                  the admin panel it is previewed inside. */}
              <iframe
                title="Email preview"
                srcDoc={previewHtml}
                sandbox=""
                className="h-[26rem] rounded border border-slate-300 bg-white"
                style={{ width: device === "mobile" ? "375px" : "100%" }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Pacing                                                            */}
      {/* ---------------------------------------------------------------- */}
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-900">Sending pace</h3>
        <p className="mt-1 text-xs text-slate-500">
          Messages go out in small chunks with a random pause between each one.
          Both the volume and the irregular rhythm matter: a few hundred emails
          leaving at a steady cadence is what gets a sending domain blocklisted.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Emails per chunk">
            <input
              type="number"
              min={1}
              max={500}
              className={inputClass}
              value={form.ec_batch_size}
              onChange={(e) => set("ec_batch_size", e.target.value)}
            />
          </Field>
          <Field label="Minutes between chunks">
            <input
              type="number"
              min={1}
              className={inputClass}
              value={form.ec_interval_minutes}
              onChange={(e) => set("ec_interval_minutes", e.target.value)}
            />
          </Field>
          <Field label="Min gap (seconds)">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={form.ec_min_gap_seconds}
              onChange={(e) => set("ec_min_gap_seconds", e.target.value)}
            />
          </Field>
          <Field label="Max gap (seconds)">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={form.ec_max_gap_seconds}
              onChange={(e) => set("ec_max_gap_seconds", e.target.value)}
            />
          </Field>
        </div>

        {recipients.length > 0 && (
          <p className="mt-3 text-xs text-slate-600">
            {recipients.length} email{recipients.length === 1 ? "" : "s"} will
            take <strong>{estimate}</strong> to go out, with each chunk landing
            at a slightly different time.
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
        {!form.startNow && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
            <Info className="h-3.5 w-3.5" />
            Otherwise it is saved as a draft — you can send a test copy first,
            then start it.
          </p>
        )}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Actions                                                           */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        {/* The reason is stated rather than leaving a dead button, which is
            the whole complaint about a disabled control that never says why. */}
        <p className="text-xs text-slate-500">
          {blocker ? (
            <span className="flex items-center gap-1.5 text-amber-700">
              <Info className="h-3.5 w-3.5" /> {blocker}
            </span>
          ) : (
            <span className="text-emerald-700">Ready to create.</span>
          )}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || Boolean(blocker)}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            title={blocker || "Create the campaign"}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            Create campaign
          </button>
        </div>
      </div>
    </div>
  );
};

export default CampaignForm;
