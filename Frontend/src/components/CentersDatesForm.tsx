import React, { useState, useEffect } from "react";
import {
  createCenterDate,
  getCenter,
  getTrainingBatches,
} from "../services/api";
import SettingsHeader from "./Settings/SettingsHeader";


interface CentersDatesFormData {
  center_id: number;
  tb_id: number;
  tb_start: string;
  tb_end: string;
}

const CentersDatesForm = () => {
  const [formData, setFormData] = useState<CentersDatesFormData>({
    center_id: 0,
    tb_id: 0,
    tb_start: "",
    tb_end: "",
  });
  const [getTBLength, setGetTBLength] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [batches, setBatches] = useState<
    {
      [x: string]: string | number | readonly string[];
      id: number;
      name: string;
    }[]
  >([]);
  const [center, setCenter] = useState<
    { center_id: number; center_name: string }[]
  >([]);

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const data = await getTrainingBatches();
        const sortedBatches = data.data.sort(
          (a: { created_at: string }, b: { created_at: string }) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setBatches(sortedBatches);
        let getLength = sortedBatches.length;
        setGetTBLength(sortedBatches.length - 1);
        if (sortedBatches.length > 0) {
          const latestBatch = sortedBatches[getLength - 1];

          setFormData((prev) => {
            const newFormData = {
              ...prev,
              tb_id: Number(latestBatch.tb_id) || 0,
            };
            return newFormData;
          });
        }
      } catch (err: any) {
        console.error("Error fetching batches:", err);
      }
    };
    const fetchCenter = async () => {
      try {
        const data = await getCenter();
        setCenter(data);
      } catch (error) {
        console.error("Error fetching training batches:", error);
      }
    };

    fetchCenter();
    fetchBatches();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Validate tb_id
    if (!formData.tb_id || isNaN(formData.tb_id) || formData.tb_id === 0) {
      setError("Training Batch ID is required");
      setLoading(false);
      return;
    }
    try {
      await createCenterDate(formData);
      setSuccess("Center date created successfully");
      setFormData({
        center_id: 0,
        tb_id: 0,
        tb_start: "",
        tb_end: "",
      });
    } catch (err: any) {
      setError(err.message || "Failed to create center date");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "center_id" || name === "tb_id" ? parseInt(value) || 0 : value,
    }));
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <SettingsHeader
        SettingsHeader="Create Center Date"
        SettingDescription="Create Center Date"
      />
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">
          {success}
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        <div className="space-y-2">
          <label className="block text-gray-700 font-medium">
            Training Center
          </label>
          <select
            name="center_id"
            value={formData.center_id}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
            required
          >
            <option value="">Please Select</option>
            {center.map((center) => (
              <option key={center.center_id} value={center.center_id}>
                {center.center_name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-gray-700 font-medium">
            Training Batch
          </label>
          <select
            name="tb_id"
            value={formData.tb_id}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none bg-gray-100"
            disabled
            required
          >
            {batches.length > 0 ? (
              <option value={batches[getTBLength]?.tb_id}>
                {batches[getTBLength]?.tb_name || batches[getTBLength]?.tb_name}
              </option>
            ) : (
              <option value="">Loading...</option>
            )}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-gray-700 font-medium">Start Date</label>
          <input
            type="date"
            name="tb_start"
            value={formData.tb_start}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="block text-gray-700 font-medium">End Date</label>
          <input
            type="date"
            name="tb_end"
            value={formData.tb_end}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
            required
          />
        </div>

        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className={`w-full ${
              loading ? "bg-gray-400" : "bg-emerald-500 hover:bg-emerald-600"
            } text-white py-2 px-4 rounded transition-colors`}
          >
            {loading ? "Saving..." : "Save Center Date"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CentersDatesForm;
