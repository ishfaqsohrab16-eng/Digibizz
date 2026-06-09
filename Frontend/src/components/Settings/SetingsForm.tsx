import React, { useEffect, useState } from "react";
import {
  changeAdminPassword,
  getAppSettings,
  updateAppSettings,
} from "../../services/api";
import { Alert, AlertDescription } from "../../components/ui/alert";
import ProfilePhoto from "./ProfilePhoto";
import SettingsHeader from "./SettingsHeader";
import { useBatch } from "../../context/BatchContext";
import { toast } from "sonner";

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
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [requireStudentDocuments, setRequireStudentDocuments] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { user_id, userType } = useBatch();

  const canManageAppSettings =
    userType === "SuperAdmin" || userType === "ContentAdmin";

  useEffect(() => {
    if (!canManageAppSettings) return;

    const loadSettings = async () => {
      setSettingsLoading(true);
      try {
        const response = await getAppSettings();
        setRequireStudentDocuments(
          response.data?.requireStudentDocuments !== false
        );
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load app settings"
        );
      } finally {
        setSettingsLoading(false);
      }
    };

    void loadSettings();
  }, [canManageAppSettings]);

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

  const handleSettingsSave = async () => {
    setSettingsSaving(true);
    try {
      const response = await updateAppSettings({
        requireStudentDocuments,
      });
      setRequireStudentDocuments(
        response.data?.requireStudentDocuments !== false
      );
      toast.success("App settings updated successfully");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update app settings"
      );
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <div className="p-10 max-w-full md:max-w-4xl lg:max-w-6xl mx-auto">
      <SettingsHeader
        SettingsHeader={SettingsHeaderText}
        SettingDescription={SettingDescription}
      />
      {canManageAppSettings && (
        <div className="mb-8 rounded-lg border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Student Dashboard Access
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Control whether students must upload required documents before
                viewing the dashboard.
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Runtime file: uploads/settings/appSettings.json. If missing,
                the backend creates it with documents required by default.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 md:items-end">
              <label className="flex items-center gap-3 text-sm font-medium text-gray-800">
                <input
                  type="checkbox"
                  checked={requireStudentDocuments}
                  disabled={settingsLoading || settingsSaving}
                  onChange={(event) =>
                    setRequireStudentDocuments(event.target.checked)
                  }
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                Require documents before dashboard
              </label>
              <button
                type="button"
                onClick={handleSettingsSave}
                disabled={settingsLoading || settingsSaving}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {settingsSaving
                  ? "Saving..."
                  : settingsLoading
                  ? "Loading..."
                  : "Save Setting"}
              </button>
            </div>
          </div>
        </div>
      )}
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
