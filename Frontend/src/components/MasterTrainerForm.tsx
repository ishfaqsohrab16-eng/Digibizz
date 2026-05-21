import { registerMasterTrainer, getAllCourse } from "../services/api";
import { useToast } from "../hooks/use-toast";
import React, { useEffect, useState } from "react";
import { validateMasterTrainerForm } from "../utils/validateMasterTrainerForm";
import SettingsHeader from "./Settings/SettingsHeader";
import { MasterTrainerFormFields } from "./MasterTrainerFormFields";
import { Button } from "./ui/button";

interface MasterTrainerFormData {
  user_name: string;
  user_email: string;
  user_username: string;
  user_password: string;
  user_profile_photo: File | null;
  mt_course_id: number;
  mt_dark_mode: string;
  user_status: number;
}

const MasterTrainerForm: React.FC = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<MasterTrainerFormData>({
    user_name: "",
    user_email: "",
    user_username: "",
    user_password: "",
    user_profile_photo: null,
    mt_course_id: 0,
    mt_dark_mode: "0",
    user_status: 1,
  });

  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [course, setCourse] = useState<
    Array<{ course_id: number; course_name: string }>
  >([]);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const data = await getAllCourse();
        setCourse(data);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch courses. Please try again.",
        });
      }
    };

    fetchCourses();
  }, [toast]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.type.startsWith("image/")) {
        setErrors((prev) => ({ ...prev, file: "Please select an image file" }));
        return;
      }
      if (selectedFile.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({
          ...prev,
          file: "File size must be less than 5MB",
        }));
        return;
      }
      setFile(selectedFile);
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.file;
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validateMasterTrainerForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please check the form for errors",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await registerMasterTrainer(formData, file || undefined);
      setFile(null);
      setErrors({});
    } catch (err: any) {
      if (err.errorMessages) {
        const newErrors: Record<string, string> = {};
        err.errorMessages.forEach(
          ({ field, message }: { field: string; message: string }) => {
            newErrors[field] = message;
          }
        );
        setErrors(newErrors);
      }
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to register master trainer",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-8xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <SettingsHeader
        SettingsHeader="Create Master Trainer Date"
        SettingDescription="Create Master Trainer Date"
      />
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
        encType="multipart/form-data"
      >
        <MasterTrainerFormFields
          formData={formData}
          handleInputChange={handleInputChange}
          handleFileChange={handleFileChange}
          errors={errors}
          course={course}
        />

        <div className="md:col-span-2">
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Saving..." : "Save Master Trainer"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default MasterTrainerForm;
