import React, { useState, useEffect } from "react";
import { useBatch } from "../../context/BatchContext";
import { toast } from "sonner";
import axios from "axios";
import {
  AnnouncementFormData,
  AnnouncementFormErrors,
} from "../../types/announcements";
import { Button } from "../ui/button";
import SettingsHeader from "../Settings/SettingsHeader";
import {
  createAnnouncement,
  updateAnnouncement,
  notifyStudents,
} from "../../services/api";

interface AnnouncementFormProps {
  mode?: "create" | "edit";
  initialData?: any;
  onSuccess?: () => void;
}

const AnnouncementForm = ({
  mode = "create",
  initialData,
  onSuccess,
}: AnnouncementFormProps) => {
  const [errors, setErrors] = useState<AnnouncementFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { selectedBatchId, user_id, userType } = useBatch();

  const [formData, setFormData] = useState<AnnouncementFormData>(
    initialData || {
      ca_title: "",
      ca_message: "",
      tb_id: selectedBatchId,
      user_id: user_id,
    }
  );

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const validateForm = () => {
    const newErrors: AnnouncementFormErrors = {};
    if (!formData.ca_title.trim()) newErrors.ca_title = "Title is required";
    if (!formData.ca_message.trim())
      newErrors.ca_message = "Message is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const response =
        mode === "create"
          ? await createAnnouncement(formData)
          : await updateAnnouncement(initialData.ca_id, formData);

      if (response.success) {
        if (mode === "create") {
          try {
            await notifyStudents({
              course_id: response.data.course_id,
              center_id: response.data.center_id,
              tb_id: response.data.tb_id,
              subject: formData.ca_title,
              message: formData.ca_message,
            });
            toast.success("Announcement created and notifications sent!");
          } catch (notifyError) {
            console.error("Error sending notifications:", notifyError);
            toast.error(
              "Announcement created but notifications failed to send"
            );
          }
        } else {
          toast.success("Announcement updated successfully!");
        }

        if (onSuccess) onSuccess();
      }
    } catch (error) {
      toast.error("Failed to save announcement");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className=" p-6 max-w-8xl bg-white rounded-lg shadow-md">
      {userType === "trainer" ? (
        <SettingsHeader
          SettingsHeader={
            mode === "create" ? "Create Announcement" : "Edit Announcement"
          }
          SettingDescription="Create and manage class announcements"
        />
      ) : (
        <SettingsHeader
          SettingsHeader={"Announcement"}
          SettingDescription="Class announcements"
        />
      )}
      <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-8xl">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Announcement Title
          </label>
          <input
            type="text"
            value={formData.ca_title}
            onChange={(e) =>
              setFormData({ ...formData, ca_title: e.target.value })
            }
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          {errors.ca_title && (
            <p className="mt-1 text-sm text-red-600">{errors.ca_title}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Message
          </label>
          <textarea
            value={formData.ca_message}
            onChange={(e) =>
              setFormData({ ...formData, ca_message: e.target.value })
            }
            rows={6}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          {errors.ca_message && (
            <p className="mt-1 text-sm text-red-600">{errors.ca_message}</p>
          )}
        </div>
        {userType === "trainer" && (
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full header-gradient hover:bg-green-700 text-white"
          >
            {isSubmitting
              ? "Saving..."
              : mode === "create"
              ? "Create Announcement"
              : "Update Announcement"}
          </Button>
        )}
      </form>
    </div>
  );
};

export default AnnouncementForm;
