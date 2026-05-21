import React, { useState, useEffect } from "react";
import { useBatch } from "../../context/BatchContext";
import SettingsHeader from "../Settings/SettingsHeader";
import {
  getAllCourse,
  getCenter,
  postAssignment,
  updateAssignment,
} from "../../services/api";
import { Center, Course } from "../../types/trainer";
import { AssignmentFormData, AssignmentFormErrors } from "../../types/assignment";
import { toast } from "sonner";
import CustomCKEditor from "./CustomCKEditor";

const allowedFileTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/pdf",
  "application/zip",
];

interface AssignmentFormProps {
  mode?: "create" | "edit";
  initialData?: any;
  assignmentId?: number;
  onSuccess?: () => void;
}

const AssignmentForm = ({
  mode = "create",
  initialData,
  assignmentId,
  onSuccess,
}: AssignmentFormProps) => {
  const [errors, setErrors] = useState<AssignmentFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // You'll need to fetch these from your API
  const [course, setCourse] = useState<Course[]>([]);
  const [center, setCenter] = useState<Center[]>([]);
  const [trainingBatches, setTrainingBatches] = useState([]);
  const { selectedBatchId, user_id } = useBatch();
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  // Add loading states for centers and courses
  const [isLoadingCenters, setIsLoadingCenters] = useState(false);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [formData, setFormData] = useState<AssignmentFormData>(
    initialData || {
      tb_id: 0,
      user_id: 0,
      as_title: "",
      as_description: "",
      as_marks: "",
      as_deadline: "",
      attachment: null,
      as_status: 1,
    }
  );
  const [isMounted, setIsMounted] = useState(true);


  useEffect(() => {
    setIsMounted(true);
    if (initialData) {

      setFormData({
        ...initialData,
        as_description: initialData.as_description || "",
      });
    }

    return () => {
      setIsMounted(false);
    };
  }, [initialData]);

  // Update user_id in form data when it changes from context (and not in edit mode)
  useEffect(() => {
    if (!initialData && user_id > 0) {
      setFormData((prev) => ({
        ...prev,
        user_id: user_id,
      }));
    }
  }, [user_id, initialData]);

  const fetchCentersAndCourses = async () => {
    if (!isMounted) return;

    try {
      setIsLoadingCenters(true);
      setIsLoadingCourses(true);

      // Replace these with your actual API endpoints
      const centersResponse = await getCenter();
      const coursesResponse = await getAllCourse();

      setCenter(centersResponse);
      setCourse(coursesResponse);
    } catch (error) {
      if (isMounted) {
        console.error("Error fetching data:", error);
      }
    } finally {
      if (isMounted) {
        setIsLoadingCenters(false);
        setIsLoadingCourses(false);
      }
    }
  };

  useEffect(() => {
    setIsMounted(true);
    fetchCentersAndCourses();

    return () => {
      setIsMounted(false);
    };
  }, []);

  const validateFile = (file: File | null) => {
    if (!file) return null;

    if (file.size > 5 * 1024 * 1024) {
      return "File size exceeds 5MB limit";
    }

    if (!allowedFileTypes.includes(file.type)) {
      return "Invalid file type";
    }

    return null;
  };
  const handleDescriptionChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, as_description: e.target.value }));
  };
  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    const error = validateFile(file);

    setErrors((prev) => ({ ...prev, attachment: error || undefined }));
    setProfilePhoto(file);
  };

  const validateForm = () => {
    const newErrors: AssignmentFormErrors = {};

    if (!formData.as_title.trim()) newErrors.as_title = "Title is required";
    const strippedDescription = formData.as_description.replace(/<[^>]*>?/gm, "");
    if (!strippedDescription.trim()) 
      newErrors.as_description = "Description is required";
    
    if (!formData.as_marks || Number(formData.as_marks) < 1)
      newErrors.as_marks = "Marks must be at least 1";
    if (!formData.as_deadline) newErrors.as_deadline = "Deadline is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !isMounted) return;

    setIsSubmitting(true);

    try {
      formData.tb_id = selectedBatchId;

      if (mode === "create") {
        await postAssignment(formData, profilePhoto || undefined);
        // Clear cache after creating a new assignment
        const cacheKey = `assignmentList_${selectedBatchId}_${user_id}`;
        localStorage.removeItem(cacheKey);

        if (isMounted) {
          toast.success("Assignment created successfully!", {
            position: "top-right",
            duration: 5000,
            className: "bg-emerald-500 text-white",
          });
        }
      } else {
        await updateAssignment(initialData.as_id, formData, profilePhoto || undefined);
        // Clear cache after updating an assignment
        const cacheKey = `assignmentList_${selectedBatchId}_${user_id}`;
        localStorage.removeItem(cacheKey);

        if (isMounted) {
          toast.success("Assignment updated successfully!", {
            position: "top-right",
            duration: 5000,
            className: "bg-emerald-500 text-white",
          });
        }
      }

      if (isMounted) {
        if (onSuccess) {
          onSuccess();
        }

        if (mode === "create") {
          // Only reset form for create mode
          setFormData({
            tb_id: 0,
            user_id: user_id,
            as_title: "",
            as_description: "",
            as_marks: "",
            as_deadline: "",
            attachment: null,
            as_status: 1,
          });
          setProfilePhoto(null);
        }
      }
    } catch (error) {
      if (isMounted) {
        console.error("Submission error:", error);
        toast.error(
          mode === "create"
            ? "Failed to create assignment"
            : "Failed to update assignment",
          {
            position: "top-right",
            duration: 3000,
          }
        );
      }
    } finally {
      if (isMounted) {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="mx-auto p-6 bg-[hsl(var(--card))] rounded-lg shadow-md">
      <SettingsHeader
        SettingsHeader={
          mode === "create" ? "Post Assignment" : "Edit Assignment"
        }
        SettingDescription="Giving assignments to students can promote their self-learning, time management, boosts their memory retention & also allows them to revise content."
      />
      <form onSubmit={handleSubmit} className="space-y-6 w-3/4 items-start">
        <div>
          <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
            Assignment Title
          </label>
          <input
            type="text"
            name="as_title"
            value={formData.as_title}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border ${
              errors.as_title ? "border-red-500" : "border-[hsl(var(--border))]"
            } bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))]`}
          />
          {errors.as_title && (
            <p className="mt-1 text-sm text-red-600">{errors.as_title}</p>
          )}
        </div>

        <div className="form-group">
          <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
            Instructions / Description
          </label>
          <div
            className={`${
              errors.as_description ? "border border-red-500 rounded-lg" : ""
            }`}
          >
            <CustomCKEditor
              value={formData.as_description}
              onChange={(content) => {
                setFormData((prev) => ({ ...prev, as_description: content }));
                if (errors.as_description) {
                  setErrors((prev) => ({ ...prev, as_description: "" }));
                }
              }}
            />
          </div>
          {errors.as_description && (
            <p className="mt-1 text-sm text-red-600">{errors.as_description}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
            Maximum Marks
          </label>
          <input
            type="number"
            name="as_marks"
            min="1"
            value={formData.as_marks}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border ${
              errors.as_marks ? "border-red-500" : "border-[hsl(var(--border))]"
            } bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))]`}
          />
          {errors.as_marks && (
            <p className="mt-1 text-sm text-red-600">{errors.as_marks}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
            Deadline
          </label>
          <input
            type="datetime-local"
            name="as_deadline"
            value={formData.as_deadline}
            onChange={handleInputChange}
            className={`w-full px-3 py-2 border ${
              errors.as_deadline ? "border-red-500" : "border-[hsl(var(--border))]"
            } bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] rounded-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))]`}
          />
          {errors.as_deadline && (
            <p className="mt-1 text-sm text-red-600">{errors.as_deadline}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
            Attachment (optional)
          </label>
          <div className="mt-1">
            <label className="inline-block px-4 py-2 bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] rounded-md cursor-pointer hover:bg-[hsl(var(--muted)/0.9)]">
              Choose File
              <input
                type="file"
                onChange={handleFileChange}
                accept={allowedFileTypes.join(",")}
                className="hidden"
              />
            </label>
            {formData.attachment && (
              <span className="ml-3 text-sm text-[hsl(var(--muted-foreground))]">
                {formData.attachment.name}
              </span>
            )}
          </div>
          {errors.attachment && (
            <p className="mt-1 text-sm text-red-600">{errors.attachment}</p>
          )}
          <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
            Max size: 5MB • Allowed: JPG, PNG, WEBP, DOCX, XLSX, PDF, ZIP
          </p>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] py-2 px-4 rounded hover:bg-[hsl(var(--primary)/0.9)] transition-colors`}
        >
          {isSubmitting
            ? "Submitting..."
            : mode === "create"
            ? "Surprise Them"
            : "Update Assignment"}
        </button>
      </form>
    </div>
  );
};

export default AssignmentForm;
