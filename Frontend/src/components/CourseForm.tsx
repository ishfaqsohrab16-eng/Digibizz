import React, { useState } from "react";
import { createCourse } from "../services/api"; // Assuming you have an API function to create a center
import SettingsHeader from "./Settings/SettingsHeader";


export interface CourseFormData {
  course_name: string;
  course_full_name: string;
  course_status: number;
}

const CourseForm: React.FC = () => {
  const [formData, setFormData] = useState<CourseFormData>({
    course_name: "",
    course_full_name: "",
    course_status: 1,
  });
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    setErrors([]);
    setLoading(true);

    try {
      const data = await createCourse(formData);

      setMessage("Course created successfully");
      setFormData({
        course_name: "",
        course_full_name: "",
        course_status: 1,
      });
    } catch (error) {
      if (error instanceof Error && 'errors' in error) {
        const typedError = error as { errors: { msg: string }[] };
        setErrors(typedError.errors.map((err) => err.msg));
      } else if (error instanceof Error) {
        setMessage(error.message || "Failed to create course");
      } else {
        setMessage("Failed to create course");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto m-5 p-6 bg-white rounded-lg shadow-md">
      <SettingsHeader
        SettingsHeader="Create Course Date"
        SettingDescription="Create Course Date"
      />
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        <div className="space-y-2">
          <label className="block text-gray-700 font-medium">Course Name</label>
          <input
            type="text"
            name="course_name"
            value={formData.course_name}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="block text-gray-700 font-medium">
            Course Full Name
          </label>
          <input
            type="text"
            name="course_full_name"
            value={formData.course_full_name}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="block text-gray-700 font-medium">Status</label>
          <select
            name="course_status"
            value={formData.course_status}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
            required
          >
            <option value="0">Inactive</option>
            <option value="1">Active</option>
          </select>
        </div>

        <div className="space-y-2 mt-8">
          <button
            type="submit"
            className="w-full bg-emerald-500 text-white py-2 px-4 rounded hover:bg-emerald-600 transition-colors"
          >
            Save Course
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

export default CourseForm;
