import React, { useState, useEffect } from "react";
import { DynamicTable } from "./DataTable/DynamicTable";
import { TableActions } from "./DataTable/TableActions";
import { getAdminsProfile } from "../services/api";

import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import SettingsHeader from "./Settings/SettingsHeader";

interface AdminApiData {
  user_id: number;
  user_name: string;
  user_username: string;
  user_email: string;
  user_type: string;
  user_status: string;
  user_profile_photo: string;
}

interface AdminTableData extends AdminApiData {
  id: number;
}
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";
const EnrolledAdminTable: React.FC = () => {
  const [admins, setAdmins] = useState<AdminTableData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAdmins = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getAdminsProfile();

        const mappedData: AdminTableData[] = response.data.map(
          (admin: AdminApiData) => ({
            ...admin,
            id: admin.user_id,
          })
        );
        setAdmins(mappedData);
      } catch (error) {
        console.error("Error fetching admins:", error);
        setError("Failed to fetch admin data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchAdmins();
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };
  const getFullImageUrl = (imagePath: string) => {
    if (!imagePath) return "";
    if (imagePath.startsWith("http")) return imagePath;

    return `${BACKEND_URL}${imagePath}`;
  };
  const columns = [
    { key: "index", header: "#", headerClassName: "w-[50px]" },
    {
      key: "actions",
      header: "Actions",
      headerClassName: "w-[120px]",
      renderCell: ({ item }: { item: AdminTableData }) => (
        <TableActions
          onEdit={() => console.log("Edit:", item)}
          onView={() => console.log("View:", item)}
          email={item.user_email}
        />
      ),
    },
    {
      key: "user_profile_photo",
      header: "Profile",
      headerClassName: "w-[80px]",
      renderCell: ({ item }: { item: AdminTableData }) => (
        <div className="flex items-center justify-center">
          <img
            src={getFullImageUrl(item.user_profile_photo)}
            alt={item.user_name}
            className="object-cover h-10 w-10"
            onError={(e) => {
              console.error("Image failed to load:", e.currentTarget.src);
            }}
          />
        </div>
      ),
    },
    {
      key: "user_name",
      header: "Name",
      sortable: true,
      renderCell: ({ item }: { item: AdminTableData }) => (
        <div className="flex items-center gap-4">
          <span>{item.user_name}</span>
        </div>
      ),
    },
    {
      key: "user_username",
      header: "UserName",
      sortable: true,
    },
    {
      key: "user_email",
      header: "Email",
      className: "font-medium",
      sortable: true,
    },
    { key: "user_type", header: "Admin Type", sortable: true },
    {
      key: "user_status",
      header: "Status",
      sortable: true,
    },
  ];

  return (
    <div className="w-full">
      <SettingsHeader
        SettingsHeader="Enrolled Admins"
        SettingDescription="Enrolled Admins Data"
      />
      <div className="mt-8">
        <DynamicTable
          columns={columns}
          data={admins}
          onEdit={(item) => console.log("Edit:", item)}
          onView={(item) => console.log("View:", item)}
        />
      </div>
    </div>
  );
};

export default EnrolledAdminTable;
