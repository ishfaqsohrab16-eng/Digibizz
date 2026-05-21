import React, { useState, useEffect } from "react";
import { CenterUserFormData } from "../types/centerUser";
import { getCenter, registerCenterUser } from "../services/api";
import SettingsHeader from "./Settings/SettingsHeader";
import { Alert, AlertDescription } from "./ui/alert";


const RegisterCenterUser: React.FC = () => {
  const [formData, setFormData] = useState<CenterUserFormData>({
    user_name: "",
    user_username: "",
    user_password: "",
    user_email: "",
    center_id: 0,
    cu_status: 1,
  });

  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [centerList, setCenterList] = useState<any[]>([]);
  const fetchCenterList = async () => {
    const data = await getCenter();
    setCenterList(data);
  };
  useEffect(() => {
    fetchCenterList();
  }, []);

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
      formData.center_id = Number(formData.center_id);
      formData.cu_status = Number(formData.cu_status);
      const response = await registerCenterUser(formData, file || undefined);

      setSuccess(true);
      // Reset form
      setFormData({
        user_name: "",
        user_username: "",
        user_password: "",
        user_email: "",
        center_id: 0,
        cu_status: 1,
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
        SettingsHeader="Create Center User"
        SettingDescription="Register Center User Data"
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
              htmlFor="center_id"
            >
              Center
            </label>
            <select
              id="center_id"
              name="center_id"
              value={formData.center_id}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            >
              <option>Please Select Center</option>
              {centerList.map((center) => (
                <option value={center.center_id}>{center.center_name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label
              className="block text-gray-700 font-medium"
              htmlFor="cu_status"
            >
              Center User Status
            </label>
            <select
              id="cu_status"
              name="cu_status"
              value={formData.cu_status}
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

export default RegisterCenterUser;
