import React, { useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  UploadedRecipient,
  downloadCampaignListTemplate,
  uploadCampaignRecipientList,
} from "../../services/api";

interface Props {
  recipients: UploadedRecipient[];
  onChange: (recipients: UploadedRecipient[]) => void;
}

/**
 * Upload a spreadsheet of addresses to send one message to.
 *
 * The template is offered before the upload button, deliberately: the most
 * common way this goes wrong is a file with the address column headed
 * something the parser does not recognise, and handing over the exact shape
 * first prevents that rather than reporting it afterwards.
 *
 * The parsed rows are held here and posted with the campaign. Nothing is
 * stored server-side until the campaign is created, so an upload that is
 * abandoned leaves no list of addresses lying around.
 */
const RecipientListUpload: React.FC<Props> = ({ recipients, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [skipped, setSkipped] = useState<
    Array<{ line: number; email: string; reason: string }>
  >([]);
  const [skippedTotal, setSkippedTotal] = useState(0);

  const handleTemplate = async () => {
    try {
      await downloadCampaignListTemplate();
    } catch {
      toast.error("Could not download the template");
    }
  };

  const handleFile = async (file?: File | null) => {
    if (!file) return;

    setUploading(true);
    setFileName(file.name);
    try {
      const result = await uploadCampaignRecipientList(file);
      const accepted = result.recipients || [];
      onChange(accepted);
      setSkipped(result.skipped || []);
      // The server reports every skipped row, so the count is the list length.
      setSkippedTotal((result.skipped || []).length);
      toast.success(
        `${result.accepted ?? accepted.length} address(es) ready` +
          (result.skipped?.length ? `, ${result.skipped.length} skipped` : "")
      );
    } catch (error: any) {
      onChange([]);
      setSkipped(error?.response?.data?.skipped || []);
      setSkippedTotal((error?.response?.data?.skipped || []).length);
      toast.error(
        error?.response?.data?.message ||
          (error instanceof Error ? error.message : "Could not read that file")
      );
    } finally {
      setUploading(false);
      // Cleared so re-selecting the same file after a fix still fires onChange.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Email list
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Upload a spreadsheet with one <strong>Email</strong> column. Everyone
            on the list receives the same message.
          </p>
        </div>
        <button
          type="button"
          onClick={handleTemplate}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Download className="h-3.5 w-3.5" /> Download template
        </button>
      </div>

      <div className="mt-4">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(event) => handleFile(event.target.files?.[0])}
          className="hidden"
          id="recipient-list-file"
        />
        <label
          htmlFor="recipient-list-file"
          className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-slate-300 px-4 py-8 text-center hover:border-emerald-400 hover:bg-emerald-50/40"
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          ) : (
            <Upload className="h-6 w-6 text-slate-400" />
          )}
          <span className="mt-2 text-sm font-medium text-slate-700">
            {uploading ? "Reading the file…" : "Choose a .xlsx or .csv file"}
          </span>
          <span className="mt-0.5 text-xs text-slate-500">
            Up to 5 MB, 20,000 rows
          </span>
        </label>
      </div>

      {recipients.length > 0 && (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="h-4 w-4" />
            {recipients.length} address(es) ready
            {fileName ? ` from ${fileName}` : ""}
          </p>
          <div className="mt-2 max-h-32 overflow-y-auto rounded border border-emerald-200 bg-white p-2">
            <ul className="space-y-0.5 font-mono text-[11px] text-slate-700">
              {recipients.slice(0, 50).map((row) => (
                <li key={row.email}>{row.email}</li>
              ))}
            </ul>
            {recipients.length > 50 && (
              <p className="mt-1 text-[11px] text-slate-500">
                …and {recipients.length - 50} more
              </p>
            )}
          </div>
        </div>
      )}

      {skipped.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            {skippedTotal} row(s) skipped
          </p>
          {/* Line numbers are the ones shown in Excel, so a row can be found
              and fixed without counting. */}
          <ul className="mt-1.5 max-h-32 space-y-0.5 overflow-y-auto text-xs text-amber-900">
            {skipped.map((row, index) => (
              <li key={`${row.line}-${index}`}>
                Row {row.line}: {row.email || "(blank)"} — {row.reason}
              </li>
            ))}
          </ul>
          {skippedTotal > skipped.length && (
            <p className="mt-1 text-xs text-amber-700">
              …and {skippedTotal - skipped.length} more not listed.
            </p>
          )}
        </div>
      )}

      {recipients.length === 0 && !uploading && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Nothing uploaded yet — the campaign cannot be created without a list.
        </p>
      )}
    </div>
  );
};

export default RecipientListUpload;
