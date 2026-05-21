import React, { useState, useEffect } from "react";
import {
  registerStudent,
  getCenter,
  getTrainingBatches,
  getAllCourse,
  updateStudent,
} from "../../services/api";
import { StudentRegistrationData } from "../../types/student";
import StudentFormFields from "./StudentFormFields";
import { generateRollNumber } from "../../utils/rollNumber";
import { TrainerApiData } from "../../types/trainer";
import { useBatch } from "../../context/BatchContext";
import SettingsHeader from "../Settings/SettingsHeader";
import { set } from "date-fns";

interface StudentFormProps {
  initialData?: StudentRegistrationData | null;
  onClose?: () => void;
}

const StudentForm: React.FC<StudentFormProps> = ({ initialData, onClose }) => {
  const [getTBLength, setGetTBLength] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isChecked, setIsChecked] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [trainers, setTrainers] = useState<TrainerApiData[]>([]);
  const { selectedBatchId, selectedBatchName } = useBatch();
  const [filteredTrainers, setFilteredTrainers] = useState<TrainerApiData[]>(
    []
  );
  const [formData, setFormData] = useState<StudentRegistrationData>({
    std_rollno: "",
    std_cnic: "",
    user_name: "",
    user_username: "",
    std_fathername: "",
    std_gender: "Male",
    std_qualification: "",
    std_district: "",
    user_email: "",
    std_phone: "",
    user_password: "",
    confirm_password: "",
    user_type: "Student",
    course_id: 0,
    center_id: 0,
    t_id: 0,
    tb_id: selectedBatchId,
    user_status: 0,
    dark_mode: "0",
    special_case: 0,
    special_case_comments: "",
    ...initialData, // Populate form with initial data if provided
  });
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: checked ? 1 : 0,
    }));
  };

  const [batches, setBatches] = useState<
    {
      [x: string]: string | number | readonly string[];
      id: number;
      name: string;
    }[]
  >([]);

  useEffect(() => {
    if (selectedBatchId && selectedBatchName) {
      setBatches([
        {
          id: selectedBatchId,
          name: selectedBatchName,
        },
      ]);
    }
  }, [selectedBatchId, selectedBatchName]);

  const [center, setCenter] = useState<
    { center_id: number; center_name: string }[]
  >([]);
  const [course, setCourse] = useState<
    { course_id: number; course_name: string }[]
  >([]);
  const [isMounted, setIsMounted] = useState(true);

  const fetchCenter = async () => {
    if (!isMounted) return;

    try {
      const data = await getCenter();
      if (isMounted) {
        setCenter(data);
      }
    } catch (error) {
      if (isMounted) {
        console.error("Error fetching training batches:", error);
      }
    }
  };

  const fetchCourses = async () => {
    if (!isMounted) return;

    try {
      const data = await getAllCourse();
      if (isMounted) {
        setCourse(data);
      }
    } catch (error) {
      if (isMounted) {
        console.error("Error fetching courses:", error);
      }
    }
  };

  useEffect(() => {
    setIsMounted(true);

    // Return cleanup function to prevent state updates after unmount
    return () => {
      setIsMounted(false);
    };
  }, []);

  useEffect(() => {
    if (isMounted) {
      fetchCourses();
      fetchCenter();
    }
  }, [isMounted]);

  useEffect(() => {
    if (initialData && isMounted) {
      setFormData((prev) => ({
        ...prev,
        ...initialData,
      }));
    }
  }, [initialData, isMounted]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProfilePhoto(e.target.files[0]);
    }
  };

  // Determine if we're in edit mode
  const isEditMode = !!initialData;
  const generateUsernameFromEmail = (email: string): string => {
    if (!email.includes("@")) return ""; // basic validation
    const username = email.split("@")[0];
    return `${username}@`;
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMounted) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isEditMode) {
        // Update existing student
        await updateStudent(formData, profilePhoto || undefined);

        // Clear all related student profile caches
        const cachePattern = `studentsProfile_`;
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith(cachePattern)) {
            localStorage.removeItem(key);
          }
        });

        // Only update UI if component is still mounted
        if (isMounted) {
          setSuccess("Student updated successfully");

          // Close the form after a successful update with a slight delay
          // to allow the user to see the success message
          if (onClose) {
            const timeoutId = setTimeout(() => {
              if (isMounted) {
                onClose();
              }
            }, 1500);

            // Clear timeout in cleanup function
            return () => clearTimeout(timeoutId);
          }
        }
      } else {
        // Create new student

        const rollNumber = generateRollNumber(selectedBatchId);
        const user_username = generateUsernameFromEmail(formData.user_email);
        const updatedFormData = {
          ...formData,
          std_rollno: rollNumber,
          user_username: user_username,
        };
        updatedFormData.tb_id = selectedBatchId;
        await registerStudent(updatedFormData, profilePhoto || undefined);

        // Clear all related student profile caches
        const cachePattern = `studentsProfile_`;
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith(cachePattern)) {
            localStorage.removeItem(key);
          }
        });

        // Only update UI if component is still mounted
        if (isMounted) {
          setSuccess("Student registration successful");

          // Clear form if it's a new registration (not an edit)
          setFormData({
            std_rollno: "",
            std_cnic: "",
            user_name: "",
            user_username: "",
            std_fathername: "",
            std_gender: "Male",
            std_qualification: "",
            std_district: "",
            user_email: "",
            std_phone: "",
            user_password: "",
            confirm_password: "",
            user_type: "",
            course_id: 0,
            center_id: 0,
            t_id: 0,
            tb_id: selectedBatchId,
            user_status: 0,
            dark_mode: "0",
            special_case: 0,
            special_case_comments: "",
          });

          // Close the form after a successful creation with a slight delay
          if (onClose) {
            const timeoutId = setTimeout(() => {
              if (isMounted) {
                onClose();
              }
            }, 1500);

            // Clear timeout in cleanup function
            return () => clearTimeout(timeoutId);
          }
        }
      }
    } catch (err: any) {
      if (isMounted) {
        setError(
          err.message ||
            `Failed to ${isEditMode ? "update" : "register"} student`
        );
      }
    } finally {
      if (isMounted) {
        setLoading(false);
      }
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Handle filtering trainers when course or center changes
    if (name === "course_id" || name === "center_id") {
      const newFormData = {
        ...formData,
        [name]: Number(value),
      };

      setFormData((prev) => ({
        ...prev,
        [name]: Number(value),
        t_id: 0, // Reset trainer selection
      }));
    }
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <SettingsHeader
        SettingsHeader={isEditMode ? "Edit Student" : "Create New Student"}
        SettingDescription={
          isEditMode ? "Update Student Information" : "Create New Student Data"
        }
      />

      {/* Show back button only if onClose is provided */}
      {onClose && (
        <button
          onClick={onClose}
          className="mb-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors flex items-center"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 mr-1"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
          Back to List
        </button>
      )}

      <div className="max-w-8xl mx-auto bg-white rounded-lg shadow-md p-4 sm:p-6 lg:p-3">
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">
            {success}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full p-4 overflow-x-auto">
            <StudentFormFields
              formData={formData}
              handleInputChange={handleInputChange}
              handleCheckboxChange={handleCheckboxChange}
              hendleFileChange={handleFileChange}
              course={course}
              center={center}
              batches={batches}
              getTBLength={getTBLength}
              isEditMode={isEditMode} // Pass edit mode to form fields
            />
          </div>
          <div className="mt-6">
            <button
              type="submit"
              disabled={loading}
              className={`w-full sm:w-auto px-6 py-3 ${
                loading ? "bg-gray-400" : "bg-emerald-500 hover:bg-emerald-600"
              } text-white rounded-md transition-colors duration-200 ease-in-out`}
            >
              {loading
                ? "Saving..."
                : isEditMode
                ? "Update Student"
                : "Register Student"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudentForm;
