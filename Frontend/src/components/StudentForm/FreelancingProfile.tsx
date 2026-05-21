import React, { useState, useEffect } from "react";
import {
  Link2,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileX,
  FileCheck,
} from "lucide-react";
import {
  createFreelancerProfile,
  getFreelancerProfiles,
} from "../../services/api";
import { useBatch } from "../../context/BatchContext";

export interface FreelanceProfile {
  user_id: number;
  ep_name: string;
  sfp_link: string;
  sfp_status: number;
  sfp_date: string;
}

const REQUIRED_PLATFORMS = ["Fiverr", "Upwork"];
const OPTIONAL_PLATFORMS = [
  "99designs",
  "Amazon",
  "Behance",
  "Cross Over",
  "Demand Media",
  "Design Crowd",
  "Dribbble",
  "Facebook",
  "Freelancer",
  "Google Adsense",
  "LinkedIn",
  "Markaz",
  "People Per Hour",
  "Simply Hired",
  "Toptal",
  "Truelancer",
];

const FREELANCE_STATUS_LABELS = {
  [-1]: { text: "Not Uploaded", icon: FileX, color: "red" },
  [0]: { text: "Pending", icon: AlertCircle, color: "yellow" },
  [1]: { text: "Approved", icon: FileCheck, color: "green" },
  [2]: { text: "Rejected", icon: FileX, color: "red" },
} as const;

export function FreelancingProfile() {
  const [profiles, setProfiles] = useState<FreelanceProfile[]>([]);
  const { user_id } = useBatch();
  const [newProfile, setNewProfile] = useState({
    link: "",
  });
  const [isAdding, setIsAdding] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("");

  useEffect(() => {
    fetchProfiles();
  }, [user_id]);

  const fetchProfiles = async () => {
    try {
      const response = await getFreelancerProfiles(user_id);
      setProfiles(response);
    } catch (error) {
      console.error("Error fetching profiles:", error);
    }
  };

  const handleSubmit = async (platform: string) => {
    const profileData: FreelanceProfile = {
      user_id: user_id,
      ep_name: platform,
      sfp_link: newProfile.link,
      sfp_status: 0,
      sfp_date: new Date().toISOString(),
    };

    try {
      const response = await createFreelancerProfile(profileData);
      await fetchProfiles(); // Refetch all profiles to get updated data
      setIsAdding(false);
      setNewProfile({ link: "" });
    } catch (error) {
      console.error("Error creating profile:", error);
    }
  };

  const getProfileStatus = (platform: string) => {
    const profile = profiles.find((p) => p.ep_name === platform);
    return profile ? profile.sfp_status : -1; // Return -1 if not found
  };

  const profileExists = (platform: string) => {
    const profile = profiles.find((p) => p.ep_name === platform);
    return profile?.sfp_status === 0 || profile?.sfp_status === 1;
  };

  const getLastUpdate = (platform: string) => {
    const profile = profiles.find((p) => p.ep_name === platform);
    if (!profile) return "Never";

    const date = new Date(profile.sfp_date);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-6 w-full mx-auto">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 header-gradient border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-100">
            Professional Profiles
          </h2>
        </div>

        <div className="p-6">
          {/* Show table if profiles exist */}
          {profiles.length > 0 && (
            <div className="overflow-x-auto mb-8">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">
                      Platform
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">
                      Last Updated
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">
                      Profile Link
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((profile) => {
                    const statusInfo =
                      FREELANCE_STATUS_LABELS[
                        profile.sfp_status as keyof typeof FREELANCE_STATUS_LABELS
                      ];
                    const Icon = statusInfo.icon;
                    return (
                      <tr
                        key={profile.ep_name}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-4 px-4 font-medium text-gray-900">
                          {profile.ep_name}
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-500">
                          {getLastUpdate(profile.ep_name)}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center">
                            <Icon className={`w-5 h-5 text-${statusInfo.color}-500 mr-2`} />
                            <span className={`text-sm text-${statusInfo.color}-600`}>
                              {statusInfo.text}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <a
                            href={profile.sfp_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline"
                          >
                            View
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {/* ...existing code for add/edit form... */}
          <div className="mt-6 p-6 bg-gray-50 rounded-lg animate-fade-in">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Add Profile Link
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Platform
                </label>
                <select
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="" disabled>
                    Select Platform
                  </option>
                  {[...REQUIRED_PLATFORMS, ...OPTIONAL_PLATFORMS].map((platform) => (
                    <option key={platform} value={platform}>
                      {platform}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Profile URL
                </label>
                <input
                  type="url"
                  value={newProfile.link}
                  onChange={(e) => setNewProfile({ link: e.target.value })}
                  placeholder={
                    selectedPlatform
                      ? `https://www.${selectedPlatform.toLowerCase()}.com/yourusername`
                      : "Enter profile URL"
                  }
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={!selectedPlatform}
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setSelectedPlatform("");
                  }}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSubmit(selectedPlatform)}
                  disabled={!newProfile.link || !selectedPlatform}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:bg-blue-300 disabled:cursor-not-allowed"
                >
                  Save Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
