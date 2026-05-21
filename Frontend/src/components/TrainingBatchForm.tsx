import React from "react";
import { useTrainingBatch } from "../hooks/useTrainingBatch";
import SettingsHeader from "./Settings/SettingsHeader";


const TrainingBatchForm: React.FC = () => {
  const {
    formData,
    message,
    errors,
    isLoading,
    handleSubmit,
    handleInputChange,
  } = useTrainingBatch();

  return (
    <div className="w-full max-w-8xl mx-auto p-4 sm:p-6 bg-white rounded-lg shadow-md">
      <SettingsHeader
        SettingsHeader="Create New Training Batch"
        SettingDescription="Create a New Trainers Batch"
      />
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        Create Training Batch
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-2">
            <label className="block text-gray-700 font-medium">
              Batch Name
            </label>
            <input
              type="text"
              name="tb_name"
              value={formData.tb_name}
              onChange={handleInputChange}
              className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-gray-700 font-medium">
              Batch Slug
            </label>
            <input
              type="text"
              name="tb_slug"
              value={formData.tb_slug}
              onChange={handleInputChange}
              className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
              required
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-gray-700 font-medium mb-2">
              Description
            </label>
            <input
              type="text"
              name="tb_descrip"
              value={formData.tb_descrip}
              onChange={handleInputChange}
              className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-gray-700 font-medium">
              Start Date
            </label>
            <input
              type="date"
              name="tb_start"
              value={formData.tb_start}
              onChange={handleInputChange}
              className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
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
              className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-gray-700 font-medium">Status</label>
            <select
              name="tb_status"
              value={formData.tb_status}
              onChange={handleInputChange}
              className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
              required
            >
              <option value="0">Inactive</option>
              <option value="1">Active</option>
            </select>
          </div>
          <div className="space-y-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full sm:w-auto min-w-[420px] mt-8 bg-emerald-500 text-white py-2.5 px-6 rounded-md hover:bg-emerald-600 transition-colors disabled:bg-emerald-300 disabled:cursor-not-allowed font-medium text-sm sm:text-base"
            >
              {isLoading ? "Saving..." : "Save Training Batch"}
            </button>
          </div>
        </div>
      </form>

      {message && (
        <div
          className={`mt-6 p-4 rounded-md ${
            message.includes("success")
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {message}
        </div>
      )}

      {errors.length > 0 && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <ul className="list-disc list-inside text-red-700 space-y-1">
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TrainingBatchForm;
