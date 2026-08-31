import React, { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  BulkEnrollPreview,
  BulkEnrollResult,
  BulkEnrollRow,
  BulkEnrollStatus,
  bulkEnrollByCnic,
  downloadEnrollmentCnicTemplate,
  previewBulkEnrollment,
} from "../../services/api";

interface Props {
  open: boolean;
  tbId: number | string;
  batchName?: string;
  onClose: () => void;
  /** Called after a run that enrolled at least one person, to refresh the list. */
  onEnrolled: () => void;
}

/**
 * How each outcome is presented.
 *
 * Only "ready" and "enrolled" are green. Everything else is a row the operator
 * needs to look at - and they are deliberately not all red, because "already
 * enrolled" is a normal, harmless outcome of re-running a list, while "not
 * found" usually means a typo somebody has to go and fix.
 */
const STATUS_STYLES: Record<BulkEnrollStatus, { label: string; className: string }> = {
  ready: { label: "Will enrol", className: "bg-emerald-100 text-emerald-800" },
  enrolled: { label: "Enrolled", className: "bg-emerald-100 text-emerald-800" },
  already_enrolled: { label: "Already enrolled", className: "bg-slate-100 text-slate-700" },
  // A bulk upload never produces this: the list is the panel's decision, so
  // it enrols regardless. Kept because the single Enroll button still does.
  not_recommended: { label: "Not recommended", className: "bg-amber-100 text-amber-800" },
  not_found: { label: "Not found", className: "bg-rose-100 text-rose-800" },
  no_email: { label: "No email", className: "bg-amber-100 text-amber-800" },
  email_taken: { label: "Email in use", className: "bg-amber-100 text-amber-800" },
  failed: { label: "Failed", className: "bg-rose-100 text-rose-800" },
};

const errorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message ||
  (error instanceof Error ? error.message : fallback);

/**
 * Enrol a list of candidates from an uploaded sheet of CNIC numbers.
 *
 * The flow is upload -> see exactly what will happen -> confirm, and never
 * upload-and-go. Enrolling creates real LMS accounts and sends real email to
 * real applicants, and there is no undo, so the operator sees who is affected
 * and who is not before any of it happens.
 *
 * The file carries CNIC numbers and nothing else. Every other detail comes from
 * the candidate record the interview panel already filled in, because a
 * spreadsheet typed by hand is not a source of truth about somebody's name,
 * course or centre.
 */
const BulkEnrollDialog: React.FC<Props> = ({
  open,
  tbId,
  batchName,
  onClose,
  onEnrolled,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BulkEnrollPreview | null>(null);
  const [result, setResult] = useState<BulkEnrollResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const rows: BulkEnrollRow[] = useMemo(
    () => result?.results || preview?.plan || [],
    [result, preview]
  );

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const close = () => {
    if (checking || enrolling) return;
    reset();
    onClose();
  };

  const handleFile = async (chosen: File | null) => {
    setFile(chosen);
    setPreview(null);
    setResult(null);
    if (!chosen) return;

    setChecking(true);
    try {
      setPreview(await previewBulkEnrollment(chosen, tbId));
    } catch (error) {
      toast.error(errorMessage(error, "Could not read that file"));
      reset();
    } finally {
      setChecking(false);
    }
  };

  const handleEnroll = async () => {
    if (!file) return;
    setEnrolling(true);
    try {
      const outcome = await bulkEnrollByCnic(file, tbId);
      setResult(outcome);
      if (outcome.enrolled > 0) {
        toast.success(`Enrolled ${outcome.enrolled} candidate(s)`);
        onEnrolled();
      } else {
        toast.warning("Nobody was enrolled - see the breakdown");
      }
    } catch (error) {
      toast.error(errorMessage(error, "Bulk enrolment failed"));
    } finally {
      setEnrolling(false);
    }
  };

  const handleTemplate = async () => {
    try {
      await downloadEnrollmentCnicTemplate();
    } catch (error) {
      toast.error(errorMessage(error, "Could not download the template"));
    }
  };

  if (!open) return null;

  const summary = preview?.summary;
  const skipped = result?.skipped || preview?.skipped || [];
  const busy = checking || enrolling;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Enrol from a CNIC list
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Upload the interview panel's CNIC numbers
              {batchName ? ` for ${batchName}` : ""}. Everyone on the list is
              enrolled, recommended at interview or not — the list is the
              decision. Everything else is taken from each candidate's own
              record.
            </p>
          </div>
          <button
            onClick={close}
            disabled={busy}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Step 1: the file */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleTemplate}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" /> Download template
            </button>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-slate-400 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              <Upload className="h-4 w-4" />
              {file ? "Choose a different file" : "Choose .xlsx or .csv"}
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                disabled={busy}
                onChange={(event) => handleFile(event.target.files?.[0] || null)}
              />
            </label>

            {file && (
              <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                <FileSpreadsheet className="h-4 w-4 text-slate-400" />
                {file.name}
              </span>
            )}
          </div>

          {checking && (
            <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking these CNICs
              against the candidate list…
            </div>
          )}

          {/* Step 2: what will happen */}
          {summary && !result && (
            <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-700">
                <strong className="text-slate-900">{summary.ready}</strong> of{" "}
                {preview?.rowsInFile} row(s) will be enrolled.
              </p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
                {summary.already_enrolled > 0 && (
                  <span>{summary.already_enrolled} already enrolled</span>
                )}
                {summary.unrecommended_included > 0 && (
                  <span className="text-amber-700">
                    {summary.unrecommended_included} not marked recommended at
                    interview (will still be enrolled)
                  </span>
                )}
                {summary.not_found > 0 && <span>{summary.not_found} not found</span>}
                {summary.no_email > 0 && <span>{summary.no_email} without an email</span>}
                {summary.email_taken > 0 && (
                  <span>{summary.email_taken} whose email is already in use</span>
                )}
                {summary.unreadable > 0 && (
                  <span>{summary.unreadable} unreadable row(s)</span>
                )}
              </div>
            </div>
          )}

          {/* Step 3: what happened */}
          {result && (
            <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-900">
                <CheckCircle2 className="h-4 w-4" />
                {result.message}
                {result.failed > 0 && ` ${result.failed} failed.`}
              </p>
              {result.note && (
                <p className="mt-1 text-xs text-emerald-800">{result.note}</p>
              )}
            </div>
          )}

          {rows.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">CNIC</th>
                    <th className="px-3 py-2">Candidate</th>
                    <th className="px-3 py-2">Outcome</th>
                    <th className="px-3 py-2">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const style = STATUS_STYLES[row.status] || {
                      label: row.status,
                      className: "bg-slate-100 text-slate-700",
                    };
                    return (
                      <tr
                        key={`${row.cnic}-${row.line}`}
                        className="border-t border-slate-200"
                      >
                        <td className="px-3 py-2 text-slate-400">{row.line}</td>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-700">
                          {row.formatted}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {row.name || <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${style.className}`}
                          >
                            {style.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600">
                          {row.message}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Rows that were not even a CNIC. Kept separate: these are a problem
              with the spreadsheet, not with a candidate. */}
          {skipped.length > 0 && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
                <AlertTriangle className="h-4 w-4" />
                {skipped.length} row(s) could not be read
              </p>
              <ul className="mt-2 space-y-1 text-xs text-amber-800">
                {skipped.slice(0, 12).map((row) => (
                  <li key={row.line}>
                    Row {row.line}
                    {row.raw ? ` ("${row.raw}")` : ""}: {row.reason}
                  </li>
                ))}
                {skipped.length > 12 && (
                  <li>…and {skipped.length - 12} more</li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            onClick={close}
            disabled={busy}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            {result ? "Done" : "Cancel"}
          </button>

          {!result && (
            <button
              onClick={handleEnroll}
              disabled={busy || !summary || summary.ready === 0}
              title={
                summary && summary.ready === 0
                  ? "Nobody in this file can be enrolled"
                  : undefined
              }
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {enrolling && <Loader2 className="h-4 w-4 animate-spin" />}
              {summary ? `Enrol ${summary.ready} candidate(s)` : "Enrol"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkEnrollDialog;
