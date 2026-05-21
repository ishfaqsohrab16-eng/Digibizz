import { useBatch } from "../../context/BatchContext";
import { updateProfilePhoto } from "../../services/api";
import { UserData } from "../../types/admin";
import React, { useState, useEffect, useRef } from "react";

export interface UploadImageFormData {
  user_username: string;
}

const ProfilePhoto = () => {
  const BASE_URL = import.meta.env.VITE_BACKEND_URL;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const { user_profile_photo, setUserProfilePhoto } = useBatch();
  const [formData, setFormData] = useState<UploadImageFormData>({
    user_username: "",
  });
  const { user_id } = useBatch();
  const getUserType = () => {
    try {
      const admin = localStorage.getItem(`admin${user_id}`);
      if (!admin) {
        console.log("No admin data found");
        return;
      }

      const parsedAdmin: UserData = JSON.parse(admin);
      if (parsedAdmin?.id) {
        setUserProfilePhoto(parsedAdmin.profile_photo);
        setFormData({ user_username: parsedAdmin.username });
      }
    } catch (error) {
      console.error("Error parsing admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user_id > 0) {
      getUserType();
    }
  }, [user_id]);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const validateFile = (file: File): boolean => {
    const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];

    if (!allowedTypes.includes(file.type)) {
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      return false;
    }

    return true;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!validateFile(selectedFile)) {
      e.target.value = ""; // Reset file input
      return;
    }

    setFile(selectedFile);

    try {
      await handleFileUpload(selectedFile);
    } catch (error) {
      console.error("Error uploading file:", error);
    }
  };

  const handleFileUpload = async (selectedFile: File) => {
    try {
      setUploadLoading(true);
      const response = await updateProfilePhoto(formData, selectedFile);
      const admin = localStorage.getItem(`admin${user_id}`);
      if (admin) {
        const parsedAdmin: UserData = JSON.parse(admin);
        parsedAdmin.profile_photo = response.newPhotoUrl;
        localStorage.setItem(`admin${user_id}`, JSON.stringify(parsedAdmin));
      }

      setUserProfilePhoto(response.newPhotoUrl);

      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setPreviewImage(e.target.result as string);
        }
      };
      reader.readAsDataURL(selectedFile);
    } catch (error) {
      console.error("Upload error:", error);
      throw error;
    } finally {
      setUploadLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }
  return (
    <div className="w-64 text-center">
      <div className="relative group">
        <img
          src={previewImage || (user_profile_photo ? `${BASE_URL}${user_profile_photo}` : "/default-profile.png")}
          alt="Profile"
          className="w-52 h-52 mx-auto mb-4 object-cover border-4 border-white shadow-lg transition-opacity group-hover:opacity-75"
        />

        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          disabled={uploadLoading}
        />

        <button
          type="button"
          onClick={handleButtonClick}
          disabled={uploadLoading}
          className={`bg-emerald-500 text-white px-4 py-2 rounded-md hover:bg-emerald-600 transition-colors absolute bottom-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 ${
            uploadLoading ? "cursor-not-allowed opacity-50" : ""
          }`}
        >
          {uploadLoading ? "Uploading..." : "Change Photo"}
        </button>
      </div>
    </div>
  );
};

export default ProfilePhoto;
