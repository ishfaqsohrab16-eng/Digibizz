import React, { useState, useEffect } from "react";
import { registerCenterUser, getCenterUsers, getCenter } from "../services/api";
import { DataTable } from "./AdmissionPortal/DataTable";
import { DEFAULT_CENTER_USER_COLUMNS } from "../utils/tableUtils";
import SettingsHeader from "./Settings/SettingsHeader";

const themeVars = {
  background: "hsl(150 100% 97%)",
  card: "hsl(0 0% 100%)",
  border: "hsl(150 54% 94%)",
  primary: "hsl(165 100% 39%)",
  foreground: "hsl(222 51% 11%)",
  mutedForeground: "hsl(220 13% 35%)",
  accent: "hsl(159 80% 47%)",
};

const initialForm = {
  user_name: "",
  user_username: "",
  user_password: "",
  user_email: "",
  center_id: "",
  cu_status: 1,
};

export default function CenterUserFormTable() {
  const [form, setForm] = useState(initialForm);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [centers, setCenters] = useState<any[]>([]);
  const [columns, setColumns] = useState(DEFAULT_CENTER_USER_COLUMNS);

  useEffect(() => {
    fetchUsers();
    fetchCenters();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await getCenterUsers();
      setUsers(res.data || res); // handle both {data:[]} and [] response
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  async function fetchCenters() {
    try {
      const data = await getCenter();
      setCenters(data);
    } catch (e: any) {
      setCenters([]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await registerCenterUser(
        {
          ...form,
          center_id: Number(form.center_id),
          cu_status: Number(form.cu_status),
        },
        profilePhoto || undefined
      );
      setSuccess("Center User registered successfully");
      setForm(initialForm);
      setProfilePhoto(null);
      fetchUsers();
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }

  return (
    <div
      style={{
        background: themeVars.background,
        minHeight: "100vh",
        padding: "2rem",
        color: themeVars.foreground,
      }}
    >
      <div
        className="max-w-2xl mx-auto mb-8 bg-white rounded-lg shadow-md border"
        style={{
          background: themeVars.card,
          border: `1px solid ${themeVars.border}`,
        }}
      >
        <SettingsHeader
          SettingsHeader="Register Center User"
          SettingDescription="Create a new Center Manager user"
        />
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 p-6">
          <div>
            <label className="block font-medium mb-1">Name</label>
            <input
              type="text"
              value={form.user_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, user_name: e.target.value }))
              }
              required
              className="w-full p-2 border rounded"
              style={{ borderColor: themeVars.border }}
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Username</label>
            <input
              type="text"
              value={form.user_username}
              onChange={(e) =>
                setForm((f) => ({ ...f, user_username: e.target.value }))
              }
              required
              className="w-full p-2 border rounded"
              style={{ borderColor: themeVars.border }}
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Password</label>
            <input
              type="password"
              value={form.user_password}
              onChange={(e) =>
                setForm((f) => ({ ...f, user_password: e.target.value }))
              }
              required
              className="w-full p-2 border rounded"
              style={{ borderColor: themeVars.border }}
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Email</label>
            <input
              type="email"
              value={form.user_email}
              onChange={(e) =>
                setForm((f) => ({ ...f, user_email: e.target.value }))
              }
              required
              className="w-full p-2 border rounded"
              style={{ borderColor: themeVars.border }}
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Center</label>
            <select
              value={form.center_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, center_id: e.target.value }))
              }
              required
              className="w-full p-2 border rounded"
              style={{ borderColor: themeVars.border }}
            >
              <option value="">Select Center</option>
              {centers.map((center) => (
                <option
                  key={center.center_id || center.id}
                  value={center.center_id || center.id}
                >
                  {center.center_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-medium mb-1">Status</label>
            <select
              value={form.cu_status}
              onChange={(e) =>
                setForm((f) => ({ ...f, cu_status: Number(e.target.value) }))
              }
              className="w-full p-2 border rounded"
              style={{ borderColor: themeVars.border }}
            >
              <option value={1}>Active</option>
              <option value={0}>Inactive</option>
            </select>
          </div>
          <div>
            <label className="block font-medium mb-1">Profile Photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setProfilePhoto(e.target.files?.[0] || null)}
              className="w-full"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-emerald-500 text-white py-2 px-4 rounded hover:bg-emerald-600 transition-colors font-semibold"
          >
            {loading ? "Registering..." : "Register"}
          </button>
          {error && <div className="text-red-500 mt-2">{error}</div>}
          {success && <div className="text-green-600 mt-2">{success}</div>}
        </form>
      </div>
      <div
        className="max-w-5xl mx-auto bg-white rounded-lg shadow-md border"
        style={{
          background: themeVars.card,
          border: `1px solid ${themeVars.border}`,
        }}
      >
        <SettingsHeader
          SettingsHeader="Center Users"
          SettingDescription="List of all Center Manager users"
        />
        <div className="p-6">
          <DataTable
            data={users}
            columns={columns}
            setColumns={setColumns}
            isActionBtn={false}
            photo="user_profile_photo"
            isLoading={loading}
          />
        </div>
      </div>
    </div>
  );
}
