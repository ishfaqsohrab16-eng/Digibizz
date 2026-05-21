import React, { useState } from "react";
import { changeAdminPassword } from "../../services/api";
import { Alert, AlertDescription } from "../../components/ui/alert";
import ProfilePhoto from "./ProfilePhoto";
import SettingsHeader from "./SettingsHeader";
import { useBatch } from "../../context/BatchContext";

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export const SettingsForm: React.FC = () => {
  const [formData, setFormData] = useState<PasswordFormData>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { user_id } = useBatch();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validation
    if (formData.newPassword !== formData.confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (formData.newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const response = await changeAdminPassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
        user_id: user_id,
      });
      if (response.token) {
        localStorage.setItem("authToken", response.token);
      }
      setSuccess("Password changed successfully");
      setFormData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err: any) {
      setError(err.message || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };
  const SettingDescription =
    "We always recommend to set strong password to keep your account secure.";
  const SettingsHeaderText = "Settings";
  return (
    <div className="p-10 max-w-full md:max-w-4xl lg:max-w-6xl mx-auto">
      <SettingsHeader
        SettingsHeader={SettingsHeaderText}
        SettingDescription={SettingDescription}
      />
      <div className="flex gap-8">
        <div className="w-full max-w-md mx-auto">
          <form onSubmit={handleSubmit} className="flex-1">
            {error && (
              <Alert className="bg-red-50 text-red-800">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="bg-green-50 text-green-800">
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            <div className="mb-4">
              <label className="block text-gray-700 mb-2">
                Current Password
              </label>
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                value={formData.currentPassword}
                onChange={handleChange}
                required
                className="w-full border rounded-md p-2"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-gray-700 mb-2">New Password</label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                value={formData.newPassword}
                onChange={handleChange}
                required
                className="w-full border rounded-md p-2"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-gray-700 mb-2">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className="w-full border rounded-md p-2"
              />
            </div>

            <button
              type="submit"
              className="w-full mt-5 bg-emerald-500 text-white py-2 rounded-md hover:bg-emerald-600"
            >
              {loading ? "Changing Password..." : "Change Password"}
            </button>
          </form>
        </div>
        <ProfilePhoto />
      </div>
    </div>
  );
};
