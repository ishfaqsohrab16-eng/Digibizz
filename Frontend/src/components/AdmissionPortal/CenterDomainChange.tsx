import React from "react";
import { Search, ArrowRight, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  changeCandidateCenterCourse,
  getCandidateProfile,
  getAllCourse,
  getCenter,
} from "../../services/api";
import { useBatch } from "../../context/BatchContext";
import { isRole, ROLE } from "../../utils/roles";
import SettingsHeader from "../Settings/SettingsHeader";

interface CandidateRow {
  cand_id: number;
  cand_name: string;
  cand_cnic: string;
  cand_gender: string;
  center_id: number;
  course_id: number;
  recommended?: string;
  centers?: { center_name: string };
  courses?: { course_name: string; course_full_name: string };
}

/**
 * Move a candidate to a different center and/or course before they are
 * enrolled.
 *
 * Restricted to candidates on purpose: an enrolled student's attendance rows
 * are tied to their original center and course, so moving them here would
 * leave their history pointing at the wrong class. The server rejects any
 * candidate who has already become a student.
 */
const CenterDomainChange: React.FC = () => {
  const { selectedBatchId, userType } = useBatch();
  const isSuperAdmin = isRole(userType, ROLE.SUPER_ADMIN);

  const [candidates, setCandidates] = React.useState<CandidateRow[]>([]);
  const [centers, setCenters] = React.useState<any[]>([]);
  const [courses, setCourses] = React.useState<any[]>([]);
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<CandidateRow | null>(null);
  const [newCenterId, setNewCenterId] = React.useState<string>("");
  const [newCourseId, setNewCourseId] = React.useState<string>("");
  const [reason, setReason] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const loadCandidates = React.useCallback(async () => {
    if (!selectedBatchId || selectedBatchId < 0) return;
    setLoading(true);
    try {
      const response = await getCandidateProfile(selectedBatchId);
      setCandidates(response?.candidates || []);
    } catch {
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [selectedBatchId]);

  React.useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  React.useEffect(() => {
    (async () => {
      try {
        setCenters((await getCenter()) || []);
        setCourses((await getAllCourse()) || []);
      } catch {
        setCenters([]);
        setCourses([]);
      }
    })();
  }, []);

  const filtered = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return candidates.slice(0, 50);
    return candidates
      .filter((row) =>
        [row.cand_name, row.cand_cnic]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(term))
      )
      .slice(0, 50);
  }, [candidates, query]);

  const selectCandidate = (row: CandidateRow) => {
    setSelected(row);
    setNewCenterId(String(row.center_id || ""));
    setNewCourseId(String(row.course_id || ""));
    setReason("");
  };

  const hasChange =
    selected !== null &&
    (Number(newCenterId) !== Number(selected.center_id) ||
      Number(newCourseId) !== Number(selected.course_id));

  const handleSave = async () => {
    if (!selected || !hasChange) return;

    setSaving(true);
    try {
      const response = await changeCandidateCenterCourse(selected.cand_id, {
        center_id: Number(newCenterId) || undefined,
        course_id: Number(newCourseId) || undefined,
        reason: reason.trim() || undefined,
      });

      if (response?.success) {
        toast.success(
          `${selected.cand_name} moved to ${response.candidate.center_name} · ${response.candidate.course_name}`
        );
        setSelected(null);
        loadCandidates();
      } else {
        toast.error(response?.message || "Could not update the candidate");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update the candidate"
      );
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="container mx-auto px-4 py-10">
        <div className="mx-auto flex max-w-md flex-col items-center rounded-lg border border-amber-200 bg-amber-50 p-8 text-center">
          <ShieldAlert className="mb-3 h-8 w-8 text-amber-600" />
          <p className="text-sm font-semibold text-amber-900">Super Admin only</p>
          <p className="mt-1 text-xs text-amber-800">
            Changing a candidate's center or domain is restricted to Super Admins.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:px-8">
      <SettingsHeader
        SettingsHeader="Center / Domain Change"
        SettingDescription="Move a candidate to a different center or course before enrollment"
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="relative mb-3">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or CNIC"
              className="w-full rounded-md border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#006537]"
            />
          </div>

          <div className="max-h-96 overflow-y-auto rounded-md border border-slate-200">
            {loading && (
              <p className="px-3 py-6 text-center text-xs text-slate-500">
                Loading candidates…
              </p>
            )}

            {!loading && filtered.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-slate-500">
                No candidates found for this batch.
              </p>
            )}

            {!loading &&
              filtered.map((row) => (
                <button
                  key={row.cand_id}
                  type="button"
                  onClick={() => selectCandidate(row)}
                  className={`block w-full border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-slate-50 ${
                    selected?.cand_id === row.cand_id ? "bg-[#006537]/5" : ""
                  }`}
                >
                  <p className="text-sm font-medium text-slate-800">{row.cand_name}</p>
                  <p className="text-xs text-slate-500">
                    {row.cand_cnic} · {row.centers?.center_name || "—"} ·{" "}
                    {row.courses?.course_name || "—"}
                  </p>
                </button>
              ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          {!selected ? (
            <p className="py-16 text-center text-sm text-slate-500">
              Select a candidate to change their center or course.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-800">
                  {selected.cand_name}
                </p>
                <p className="text-xs text-slate-600">
                  {selected.cand_cnic} · {selected.cand_gender}
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="flex-1 rounded-md border border-slate-200 p-2.5">
                  <p className="font-semibold uppercase tracking-wide text-slate-500">
                    Currently
                  </p>
                  <p className="mt-1 text-slate-800">
                    {selected.centers?.center_name || "—"}
                  </p>
                  <p className="text-slate-600">{selected.courses?.course_name || "—"}</p>
                </div>
                <ArrowRight size={16} className="shrink-0 text-slate-400" />
                <div className="flex-1 rounded-md border border-emerald-200 bg-emerald-50 p-2.5">
                  <p className="font-semibold uppercase tracking-wide text-emerald-700">
                    Moving to
                  </p>
                  <p className="mt-1 text-emerald-900">
                    {centers.find((c) => String(c.center_id) === newCenterId)
                      ?.center_name || "—"}
                  </p>
                  <p className="text-emerald-800">
                    {courses.find((c) => String(c.course_id) === newCourseId)
                      ?.course_name || "—"}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Center</label>
                <select
                  value={newCenterId}
                  onChange={(event) => setNewCenterId(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006537]"
                >
                  <option value="">Please select</option>
                  {centers.map((center) => (
                    <option key={center.center_id} value={center.center_id}>
                      {center.center_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Course / Domain
                </label>
                <select
                  value={newCourseId}
                  onChange={(event) => setNewCourseId(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006537]"
                >
                  <option value="">Please select</option>
                  {courses.map((course) => (
                    <option key={course.course_id} value={course.course_id}>
                      {course.course_full_name || course.course_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Reason <span className="text-xs font-normal text-slate-500">(optional)</span>
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Why is this candidate being moved?"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#006537]"
                />
              </div>

              <p className="text-[11px] leading-relaxed text-slate-500">
                The target center and course must be open for this batch and the
                candidate's gender, otherwise the change is rejected.
              </p>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  disabled={saving}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!hasChange || saving}
                  className="inline-flex items-center gap-2 rounded-md bg-[#006537] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00522c] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? "Saving…" : "Apply change"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CenterDomainChange;
