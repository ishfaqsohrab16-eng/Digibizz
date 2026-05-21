import React, { useEffect, useState } from "react";
import { useBatch } from "../../context/BatchContext";
import { DataTable } from "../AdmissionPortal/DataTable";
import { Column, FilterStatus } from "../../types/columns";
import { DEFAULT_ANNOUNCEMENT_COLUMNS } from "../../utils/tableUtils";
import { Announcement } from "../../types/announcements";
import SettingsHeader from "../Settings/SettingsHeader";
import AnnouncementForm from "./AnnouncementForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { getAnnouncements, deleteAnnouncement } from "../../services/api";

function AnnouncementList() {
  const { selectedBatchId, user_id, userType } = useBatch();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [data, setData] = useState<Announcement[]>([]);
  const [columns, setColumns] = useState<Column[]>(
    DEFAULT_ANNOUNCEMENT_COLUMNS
  );
  const [activeTab, setActiveTab] = useState("AnnouncementList");
  const [viewData, setViewData] = useState<any>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState<
    number | null
  >(null);

  const fetchAnnouncements = async () => {
    try {
      const data = await getAnnouncements(selectedBatchId, user_id, userType);
      if (data.success) {
        const formattedData = data.data.map((announcement: Announcement) => ({
          ...announcement,
          t_name: announcement.trainer?.user?.user_name || "",
          course_name: announcement.course?.course_name || "",
          center_name: announcement.center?.center_name || "",
          tb_name: announcement.training_batch?.tb_name || "",
        }));
        setData(formattedData);
      }
    } catch (error) {
      console.error("Error fetching announcements:", error);
      setData([]);
    }
  };

  useEffect(() => {
    if (selectedBatchId) {
      fetchAnnouncements();
    }
  }, [selectedBatchId]);

  const handleDelete = async (ca_id: number) => {
    try {
      const response = await deleteAnnouncement(ca_id);
      if (response.success) {
        await fetchAnnouncements();
        toast.success("Announcement deleted successfully");
      }
    } catch (error) {
      toast.error("Failed to delete announcement");
    } finally {
      setDeleteDialogOpen(false);
      setAnnouncementToDelete(null);
    }
  };

  return (
    <>
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Announcement</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this announcement? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                announcementToDelete && handleDelete(announcementToDelete)
              }
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="h-screen flex flex-col mt-10 bg-mesh">
        {activeTab === "AnnouncementList" ? (
          <main className="flex-1 overflow-auto">
            <SettingsHeader
              SettingsHeader="Announcements"
              SettingDescription="Manage class announcements"
            />
            {userType === "trainer" && (
              <Button
                onClick={() => setActiveTab("AnnouncementForm")}
                className="header-gradient ml-5 hover:bg-green-700 text-white"
              >
                Create Announcement
              </Button>
            )}
            {userType === "trainer" ? (
              <DataTable
                data={data}
                columns={columns}
                filterStatus={filterStatus}
                setColumns={setColumns}
                setFilterStatus={setFilterStatus}
                isActionBtn={true}
                onView={(item) => {
                  setViewData(item);
                  setActiveTab("AnnouncementForm");
                }}
                onEdit={(item) => {
                  setViewData(item);
                  setActiveTab("AnnouncementForm");
                }}
                onDelete={(item) => {
                  setAnnouncementToDelete(item.ca_id);
                  setDeleteDialogOpen(true);
                }}
              />
            ) : (
              <DataTable
                data={data}
                columns={columns}
                filterStatus={filterStatus}
                setColumns={setColumns}
                setFilterStatus={setFilterStatus}
                isActionBtn={true}
                onView={(item) => {
                  setViewData(item);
                  setActiveTab("AnnouncementForm");
                }}
              />
            )}
          </main>
        ) : (
          <AnnouncementForm
            mode={viewData ? "edit" : "create"}
            initialData={viewData}
            onSuccess={() => {
              fetchAnnouncements();
              setActiveTab("AnnouncementList");
              setViewData(undefined);
            }}
          />
        )}
      </div>
    </>
  );
}

export default AnnouncementList;
