import React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { purgeStudent } from "../../services/api";

interface DeletableStudent {
  std_id?: number;
  std_rollno?: string;
  std_cnic?: string;
  user_name?: string;
}

interface Props {
  student: DeletableStudent | null;
  onClose: () => void;
  onDeleted: () => void;
}

/**
 * Confirmation for permanently deleting a student.
 *
 * The action cannot be undone and removes the login plus every linked record,
 * so it deliberately requires typing the roll number rather than a single
 * click. The server independently enforces SuperAdmin.
 */
const DeleteStudentDialog: React.FC<Props> = ({ student, onClose, onDeleted }) => {
  const [confirmText, setConfirmText] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    setConfirmText("");
  }, [student?.std_id]);

  if (!student) return null;

  const requiredText = student.std_rollno || student.std_cnic || "";
  const canDelete = confirmText.trim() === requiredText.trim() && !deleting;

  const handleDelete = async () => {
    if (!student.std_id) {
      toast.error("This student record has no id and cannot be deleted");
      return;
    }

    setDeleting(true);
    try {
      const response = await purgeStudent(student.std_id);
      if (response?.success) {
        toast.success(
          `${student.user_name || requiredText} and all related records were deleted`
        );
        onDeleted();
        onClose();
      } else {
        toast.error(response?.message || "Could not delete the student");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete the student"
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-start gap-3 border-b border-slate-200 p-5">
          <div className="rounded-full bg-rose-100 p-2">
            <AlertTriangle className="h-5 w-5 text-rose-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Permanently delete this student?
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              This cannot be undone.
            </p>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-semibold text-slate-800">
              {student.user_name || "Unnamed student"}
            </p>
            <p className="text-slate-600">
              {student.std_rollno}
              {student.std_cnic ? ` · ${student.std_cnic}` : ""}
            </p>
          </div>

          <div className="rounded-md border border-rose-200 bg-rose-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
              This will delete
            </p>
            <ul className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-rose-900">
              <li>• Their LMS login</li>
              <li>• Attendance records</li>
              <li>• Earnings + proof files</li>
              <li>• Assignment submissions</li>
              <li>• Exam assessments</li>
              <li>• Leave applications</li>
              <li>• Quiz attempts</li>
              <li>• Uploaded documents</li>
              <li>• Feedback</li>
              <li>• Freelancing profile</li>
              <li>• Support tickets</li>
              <li>• Profile photo</li>
            </ul>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Type <span className="font-mono font-bold">{requiredText}</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              autoComplete="off"
              placeholder={requiredText}
              className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-rose-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canDelete}
            className="inline-flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            {deleting ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteStudentDialog;
