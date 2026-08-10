import React, { useEffect, useMemo, useState } from "react";
import {
  getAdmissionControlAdmin,
  getAllCourse,
  getCenter,
  getTrainingBatches,
  saveBatchAdmissionControl,
} from "../../services/api";
import { toast } from "sonner";
import { Check, Copy, ExternalLink } from "lucide-react";
import {
  centerApplyUrl,
  centerSlug,
  centerSlugAliases,
  unifiedApplyUrl,
} from "../../utils/centerSlug";

type GenderRule = "all" | "male" | "female";

type RuleMap = Record<string, GenderRule>;

const makeRuleKey = (centerId: number, courseId: number) => `${centerId}-${courseId}`;

const copyText = async (value: string) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (error) {
    console.error("Clipboard API failed, falling back:", error);
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  } catch (error) {
    console.error("Copy fallback failed:", error);
    return false;
  }
};

const LinkActions: React.FC<{
  copyKey: string;
  url: string;
  copiedKey: string;
  onCopy: (key: string, url: string) => void;
}> = ({ copyKey, url, copiedKey, onCopy }) => (
  <div className="flex items-center gap-1">
    <button
      type="button"
      onClick={() => onCopy(copyKey, url)}
      className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
      title="Copy apply link"
    >
      {copiedKey === copyKey ? (
        <>
          <Check size={12} className="text-green-600" /> Copied
        </>
      ) : (
        <>
          <Copy size={12} /> Copy
        </>
      )}
    </button>
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
      title="Open apply link"
    >
      <ExternalLink size={12} /> Open
    </a>
  </div>
);

const AdmissionControlPanel: React.FC = () => {
  const [batches, setBatches] = useState<Array<{ tb_id: number; tb_name: string }>>([]);
  const [centers, setCenters] = useState<Array<{ center_id: number; center_name: string }>>([]);
  const [courses, setCourses] = useState<Array<{ course_id: number; course_full_name: string }>>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number>(0);
  const [rules, setRules] = useState<RuleMap>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string>("");

  const sortedBatches = useMemo(
    () => [...batches].sort((a, b) => b.tb_id - a.tb_id),
    [batches]
  );

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        const [batchRes, centerRes, courseRes, admissionRes] = await Promise.all([
          getTrainingBatches(),
          getCenter(),
          getAllCourse(),
          getAdmissionControlAdmin(),
        ]);

        const fetchedBatches = batchRes?.data || [];
        setBatches(fetchedBatches);
        setCenters(centerRes || []);
        setCourses(courseRes || []);

        if (fetchedBatches.length > 0) {
          const latest = [...fetchedBatches].sort((a, b) => b.tb_id - a.tb_id)[0];
          setSelectedBatchId(latest.tb_id);
        }

        const allRules = admissionRes?.rules || [];
        const ruleMap: RuleMap = {};
        allRules.forEach((rule: any) => {
          ruleMap[makeRuleKey(rule.center_id, rule.course_id) + `-${rule.tb_id}`] =
            rule.allowed_gender || "all";
        });
        setRules(ruleMap);
      } catch (error) {
        console.error("Failed to load admission control data:", error);
        toast.error("Failed to load admission control data.");
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const getBatchRuleKey = (centerId: number, courseId: number) =>
    `${makeRuleKey(centerId, courseId)}-${selectedBatchId}`;

  const isOpen = (centerId: number, courseId: number) =>
    Boolean(rules[getBatchRuleKey(centerId, courseId)]);

  const getAllowedGender = (centerId: number, courseId: number): GenderRule =>
    rules[getBatchRuleKey(centerId, courseId)] || "all";

  const openCourseCount = (centerId: number) =>
    courses.filter((course) => isOpen(centerId, course.course_id)).length;

  const handleToggle = (centerId: number, courseId: number, checked: boolean) => {
    const key = getBatchRuleKey(centerId, courseId);
    setRules((prev) => {
      const next = { ...prev };
      if (checked) next[key] = prev[key] || "all";
      else delete next[key];
      return next;
    });
  };

  const handleGenderChange = (centerId: number, courseId: number, gender: GenderRule) => {
    const key = getBatchRuleKey(centerId, courseId);
    setRules((prev) => ({ ...prev, [key]: gender }));
  };

  const handleCopy = async (key: string, value: string) => {
    const copied = await copyText(value);
    if (!copied) {
      toast.error("Could not copy the link. Please copy it manually.");
      return;
    }
    setCopiedKey(key);
    toast.success("Apply link copied.");
    window.setTimeout(() => setCopiedKey((current) => (current === key ? "" : current)), 2000);
  };

  const handleSave = async () => {
    if (!selectedBatchId) {
      toast.error("Please select a batch first.");
      return;
    }

    const payloadRules = Object.entries(rules)
      .filter(([key]) => key.endsWith(`-${selectedBatchId}`))
      .map(([key, allowed_gender]) => {
        const [centerId, courseId] = key.replace(`-${selectedBatchId}`, "").split("-");
        return {
          center_id: Number(centerId),
          course_id: Number(courseId),
          allowed_gender,
        };
      });

    try {
      setSaving(true);
      await saveBatchAdmissionControl({
        tb_id: selectedBatchId,
        rules: payloadRules,
      });
      toast.success("Admission control updated successfully.");
    } catch (error) {
      console.error("Failed to save admission controls:", error);
      toast.error("Failed to save admission controls.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-4">Loading admission controls...</div>;
  }

  const unifiedUrl = unifiedApplyUrl();

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-2xl font-semibold">Admission Control Panel</h2>
      <p className="text-sm text-gray-600">
        Open/close admissions by batch, center and course. You can also restrict a center-course
        slot to male or female candidates only.
      </p>

      <div className="max-w-sm">
        <label className="block text-sm font-semibold mb-2">Select Batch</label>
        <select
          value={selectedBatchId}
          onChange={(e) => setSelectedBatchId(Number(e.target.value))}
          className="w-full border rounded px-3 py-2"
        >
          <option value={0}>Select Batch</option>
          {sortedBatches.map((batch) => (
            <option key={batch.tb_id} value={batch.tb_id}>
              {batch.tb_name}
            </option>
          ))}
        </select>
      </div>

      {/* Apply links */}
      <div className="rounded border">
        <div className="border-b bg-gray-50 px-4 py-3">
          <h3 className="font-semibold">Apply links</h3>
          <p className="text-sm text-gray-600">
            The unified link lets applicants pick any open center. Each center also has its own
            dedicated link that locks the application to that center.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">All centers (unified form)</p>
            <code className="block truncate text-xs text-gray-600">{unifiedUrl}</code>
          </div>
          <LinkActions
            copyKey="unified"
            url={unifiedUrl}
            copiedKey={copiedKey}
            onCopy={handleCopy}
          />
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Center</th>
                <th className="p-2 text-left">Dedicated apply link</th>
                <th className="p-2 text-left">Status in selected batch</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {centers.map((center) => {
                const url = centerApplyUrl(center);
                const aliases = centerSlugAliases(center, centers).filter(
                  (alias) => alias !== centerSlug(center) && !/^\d+$/.test(alias) && !alias.startsWith("center-")
                );
                const openCount = openCourseCount(center.center_id);

                return (
                  <tr key={center.center_id} className="border-t align-top">
                    <td className="p-2 font-medium">{center.center_name}</td>
                    <td className="p-2">
                      <code className="break-all text-xs text-gray-700">{url}</code>
                      {aliases.length > 0 && (
                        <p className="mt-1 text-[11px] text-gray-500">
                          Short link also works: /registration/{aliases.join(", /registration/")}
                        </p>
                      )}
                    </td>
                    <td className="p-2">
                      {openCount > 0 ? (
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                          Open · {openCount} course{openCount === 1 ? "" : "s"}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          Closed
                        </span>
                      )}
                    </td>
                    <td className="p-2">
                      <LinkActions
                        copyKey={`center-${center.center_id}`}
                        url={url}
                        copiedKey={copiedKey}
                        onCopy={handleCopy}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Center</th>
              {courses.map((course) => (
                <th key={course.course_id} className="p-2 text-left min-w-[220px]">
                  {course.course_full_name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {centers.map((center) => (
              <tr key={center.center_id} className="border-t align-top">
                <td className="p-2 font-medium">
                  <div>{center.center_name}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">
                      /registration/{centerSlug(center)}
                    </code>
                    <button
                      type="button"
                      onClick={() => handleCopy(`matrix-${center.center_id}`, centerApplyUrl(center))}
                      className="text-gray-500 hover:text-gray-800"
                      title="Copy this center's apply link"
                    >
                      {copiedKey === `matrix-${center.center_id}` ? (
                        <Check size={13} className="text-green-600" />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                  </div>
                </td>
                {courses.map((course) => (
                  <td key={course.course_id} className="p-2">
                    <div className="flex flex-col gap-2">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isOpen(center.center_id, course.course_id)}
                          onChange={(e) =>
                            handleToggle(center.center_id, course.course_id, e.target.checked)
                          }
                        />
                        <span>Open Admission</span>
                      </label>
                      <select
                        className="border rounded px-2 py-1"
                        disabled={!isOpen(center.center_id, course.course_id)}
                        value={getAllowedGender(center.center_id, course.course_id)}
                        onChange={(e) =>
                          handleGenderChange(
                            center.center_id,
                            course.course_id,
                            e.target.value as GenderRule
                          )
                        }
                      >
                        <option value="all">All Genders</option>
                        <option value="male">Male Only</option>
                        <option value="female">Female Only</option>
                      </select>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !selectedBatchId}
        className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save Admission Controls"}
      </button>
    </div>
  );
};

export default AdmissionControlPanel;
