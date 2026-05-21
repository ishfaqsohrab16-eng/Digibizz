import React, { useState } from "react";
import { Alert, AlertDescription } from "./ui/alert";
import { registerAdmin } from "../services/api";
import SettingsHeader from "./Settings/SettingsHeader";


interface AdminFormData {
  user_name: string;
  user_username: string;
  user_password: string;
  user_email: string;
  admin_type: string;
  admin_status: number;
}

const ADMIN_TYPES = {
  ContentAdmin: "Content Admin",
  SuperAdmin: "Super Admin",
  ModeratorAdmin: "Moderator Admin",
} as const;

const ADMIN_STATUSES = {
  Active: "Active",
  Inactive: "Inactive",
  Pending: "Pending",
} as const;

const CreateAdminForm: React.FC = () => {
  const [formData, setFormData] = useState<AdminFormData>({
    user_name: "",
    user_username: "",
    user_password: "",
    user_email: "",
    admin_type: "ContentAdmin",
    admin_status: 1,
  });

  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(""); // Clear error when user makes changes
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }
      // Validate file size (e.g., 5MB limit)
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError("File size must be less than 5MB");
        return;
      }
      setFile(selectedFile);
      setError("");
    }
  };

  const validateForm = () => {
    if (!formData.user_password || formData.user_password.length < 8) {
      setError("Password must be at least 8 characters long");
      return false;
    }
    if (!formData.user_email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError("Please enter a valid email address");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setError("");

    try {
      const response = await registerAdmin(formData, file || undefined);

      setSuccess(true);
      // Reset form
      setFormData({
        user_name: "",
        user_username: "",
        user_password: "",
        user_email: "",
        admin_type: "ContentAdmin",
        admin_status: 1,
      });
      setFile(null);

      // Optional: Store token in local storage or context
      localStorage.setItem("adminToken", response.token);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <SettingsHeader
        SettingsHeader="Create Admins"
        SettingDescription="Create Admins Data"
      />
      <form onSubmit={handleSubmit} className="">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="space-y-1 mb-6 w-full bg-green-50 text-green-800">
            <AlertDescription>Admin registered successfully!</AlertDescription>
          </Alert>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 ">
            <label className="block text-gray-700 font-medium">Name</label>
            <input
              id="user_name"
              name="user_name"
              value={formData.user_name}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="block text-gray-700 font-medium">Username</label>
            <input
              id="user_username"
              name="user_username"
              value={formData.user_username}
              onChange={handleChange}
              required
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label
              className="block text-gray-700 font-medium"
              htmlFor="user_email"
            >
              Email
            </label>
            <input
              id="user_email"
              name="user_email"
              type="email"
              value={formData.user_email}
              onChange={handleChange}
              required
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div className="space-y-2">
            <label
              className="block text-gray-700 font-medium"
              htmlFor="user_password"
            >
              Password
            </label>
            <input
              id="user_password"
              name="user_password"
              type="password"
              value={formData.user_password}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            />
          </div>

          <div className="space-y-2">
            <label
              className="block text-gray-700 font-medium"
              htmlFor="profile_photo"
            >
              Profile Photo
            </label>
            <input
              id="profile_photo"
              name="profile_photo"
              type="file"
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
              onChange={handleFileChange}
              accept="image/*"
            />
          </div>

          <div className="space-y-2">
            <label
              className="block text-gray-700 font-medium"
              htmlFor="admin_type"
            >
              Admin Type
            </label>
            <select
              id="admin_type"
              name="admin_type"
              value={formData.admin_type}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            >
              <option value="ContentAdmin">Content Admin</option>
            </select>
          </div>
          <div className="space-y-2">
            <label
              className="block text-gray-700 font-medium"
              htmlFor="admin_type"
            >
              Admin Status
            </label>
            <select
              id="admin_type"
              name="admin_type"
              value={formData.admin_type}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            >
              <option value={1}>Active</option>
              <option value={0}>InActive</option>
            </select>
          </div>
          <div className="space-y-2 mt-8">
            <button
              type="submit"
              className="w-full bg-emerald-500 text-white py-2 px-4 rounded hover:bg-emerald-600 transition-colors"
            >
              Create
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CreateAdminForm;
