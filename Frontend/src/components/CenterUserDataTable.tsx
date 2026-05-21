import React, { useEffect, useState } from "react";
import { getCenterUsers } from "../services/api";
import { useBatch } from "../context/BatchContext";
import { Column, FilterStatus } from "../types/columns";
import { DEFAULT_CENTER_USER_COLUMNS } from "../utils/tableUtils";

import { DataTable } from "./AdmissionPortal/DataTable";
import { UserData } from "../types/admin";
import SettingsHeader from "./Settings/SettingsHeader";

function AssignmentList() {
  const { selectedBatchId } = useBatch();
  const { selectedBatchName } = useBatch();
  const [isSubmenuOpen, setIsSubmenuOpen] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [data, setData] = useState<any[]>([]);
  const [viewData, setViewData] = useState<any[]>([]);
  const [columns, setColumns] = useState<Column[]>(DEFAULT_CENTER_USER_COLUMNS);
  const [userId, setUserId] = useState<number>(0);
  const [userType, setUserType] = useState<string>("");

  const [selectedAssignmentId, setSelectedAssignmentId] = useState<
    string | number | null
  >(null);
  const toggleSubmenu = (menu: string) => {
    setIsSubmenuOpen(isSubmenuOpen === menu ? null : menu);
  };
  const { user_id } = useBatch();
  const getUserType = () => {
    try {
      const admin = localStorage.getItem(`admin${user_id}`);
      if (!admin) {
        console.log("No admin data found");
      }

      const parsedAdmin: UserData = admin ? JSON.parse(admin) : null;
      if (parsedAdmin?.id) {
        setUserId(parsedAdmin.id);
        setUserType(parsedAdmin.type);
      }
    } catch (error) {
      console.error("Error parsing admin data:", error);
    }
  };
  const fetchCenterUserProfile = async () => {
    try {
      // Extract tb_id from props

      const response = await getCenterUsers();
      // setUserId(0);
      setData(response.data);
    } catch (err) {
      console.error("Error fetching candidate profile:", err);
    }
  };

  useEffect(() => {
    if (user_id) {
      getUserType();
      fetchCenterUserProfile();
    }
  }, [selectedBatchId, user_id]);

  return (
    <div className="h-screen flex flex-col bg-mesh">
      <main className="flex-1 overflow-auto">
        <SettingsHeader
          SettingsHeader="Assignments List"
          SettingDescription="List of Assignments you submitted to your students."
        />
        <DataTable
          data={data}
          columns={columns}
          filterStatus={filterStatus}
          setColumns={setColumns}
          setFilterStatus={setFilterStatus}
          isActionBtn={false}
          onView={(item) => {
            setViewData(item);
          }}
          onEdit={() => {}}
          onDelete={() => {}}
          photo="user_profile_photo"
        />
      </main>
    </div>
  );
}

export default AssignmentList;
