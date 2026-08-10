import React, { useEffect, useMemo, useState } from "react";
import {
  getAdmissionControlAdmin,
  getAllCourse,
  getCenter,
  getTrainingBatches,
  saveBatchAdmissionControl,
} from "../../services/api";
import { toast } from "sonner";

type GenderRule = "all" | "male" | "female";

type RuleMap = Record<string, GenderRule>;

const makeRuleKey = (centerId: number, courseId: number) => `${centerId}-${courseId}`;

const AdmissionControlPanel: React.FC = () => {
  const [batches, setBatches] = useState<Array<{ tb_id: number; tb_name: string }>>([]);
  const [centers, setCenters] = useState<Array<{ center_id: number; center_name: string }>>([]);
  const [courses, setCourses] = useState<Array<{ course_id: number; course_full_name: string }>>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number>(0);
  const [rules, setRules] = useState<RuleMap>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const isCenterOpen = (centerId: number) =>
    courses.some((course) => isOpen(centerId, course.course_id));

  const getCenterRegistrationLink = (centerId: number) =>
    `${window.location.origin}/registration/center/${centerId}`;

  const getAllowedGender = (centerId: number, courseId: number): GenderRule =>
    rules[getBatchRuleKey(centerId, courseId)] || "all";

  const handleToggle = (centerId: number, courseId: number, checked: boolean) => {
    const key = getBatchRuleKey(centerId, courseId);
    setRules((prev) => {
      const next = { ...prev };
      if (checked) next[key] = prev[key] || "all";
      else delete next[key];
      return next;
    });
  };

  const handleCenterToggle = (centerId: number, checked: boolean) => {
    const batchKey = `-${selectedBatchId}`;
    setRules((prev) => {
      const next = { ...prev };
      if (checked) {
        courses.forEach((course) => {
          const key = `${makeRuleKey(centerId, course.course_id)}${batchKey}`;
          if (!next[key]) {
            next[key] = "all";
          }
        });
      } else {
        Object.keys(next).forEach((key) => {
          if (key.startsWith(`${centerId}-`) && key.endsWith(batchKey)) {
            delete next[key];
          }
        });
      }
      return next;
    });
  };

  const handleGenderChange = (centerId: number, courseId: number, gender: GenderRule) => {
    const key = getBatchRuleKey(centerId, courseId);
    setRules((prev) => ({ ...prev, [key]: gender }));
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

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Center / Link</th>
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
                <td className="p-2 align-top">
                  <div className="space-y-2">
                    <div className="font-medium">{center.center_name}</div>
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={isCenterOpen(center.center_id)}
                        onChange={(e) =>
                          handleCenterToggle(center.center_id, e.target.checked)
                        }
                      />
                      <span>Enable center registration link</span>
                    </label>
                    {isCenterOpen(center.center_id) && selectedBatchId ? (
                      <div className="text-xs text-blue-600 break-all">
                        <div className="font-semibold">Center registration link:</div>
                        <a
                          href={getCenterRegistrationLink(center.center_id)}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          {getCenterRegistrationLink(center.center_id)}
                        </a>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">
                        Toggle on to publish a center-specific registration link.
                      </div>
                    )}
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
