import React, { useState } from "react";
import { createCenter } from "../services/api"; // Assuming you have an API function to create a center
import SettingsHeader from "./Settings/SettingsHeader";


interface CenterFormData {
  center_name: string;
  center_type: string;
  center_status: "0" | "1";
  center_location: string;
  center_medium: string;
}

const CenterForm: React.FC = () => {
  const [formData, setFormData] = useState<CenterFormData>({
    center_name: "",
    center_type: "",
    center_status: "0",
    center_location: "",
    center_medium: "",
  });

  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setErrors([]);
    try {
      const data = await createCenter(formData);
      setMessage("Center created successfully");
    } catch (error: any) {
      console.error("Error:", error);
      if (error.message) {
        setMessage(error.message);
      }
      if (error.errors) {
        const specificError = error.errors.find(
          (err: any) =>
            err.msg === "Center type must be between 2 and 100 characters"
        );
        if (specificError) {
          setMessage(specificError.msg);
        } else {
          setErrors(error.errors.map((err: any) => err.msg));
        }
      }
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className="max-w-8xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <SettingsHeader
        SettingsHeader="Create New Center"
        SettingDescription="Create New Center Data"
      />
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        <div className="space-y-2">
          <label className="block text-gray-700 font-medium">Center Name</label>
          <input
            type="text"
            name="center_name"
            value={formData.center_name}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="block text-gray-700 font-medium">Center Type</label>
          <select
            name="center_type"
            value={formData.center_type}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
            required
          >
            <option value="">Select Center Type</option>
            <option value="Females">Females</option>
            <option value="Males">Males</option>
            <option value="CO Education">CO Education</option>
            {/* Add more options as needed */}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-gray-700 font-medium">Status</label>
          <select
            name="center_status"
            value={formData.center_status}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
            required
          >
            <option value="0">Inactive</option>
            <option value="1">Active</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-gray-700 font-medium">Medium</label>
          <select
            name="center_medium"
            value={formData.center_medium}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
            required
          >
            <option value="">Select Center Type</option>
            <option value="Physical">Physical</option>
            <option value="Online">Online</option>
            <option value="Hybrid">Hybrid</option>
            {/* Add more options as needed */}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-gray-700 font-medium">Location</label>
          <textarea
            name="center_location"
            value={formData.center_location}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
            required
          />
        </div>

        <div className="space-y-2 mt-8">
          <button
            type="submit"
            className="w-full bg-emerald-500 text-white py-2 px-4 rounded hover:bg-emerald-600 transition-colors"
          >
            Save Center
          </button>
        </div>
      </form>
      {message && <p className="mt-4 text-center text-red-500">{message}</p>}
      {errors.length > 0 && (
        <ul className="mt-4 text-center text-red-500">
          {errors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CenterForm;
