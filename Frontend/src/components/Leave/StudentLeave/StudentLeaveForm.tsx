import React, { useState, useEffect } from "react";
import { useBatch } from "../../../context/BatchContext";
import SettingsHeader from "../../Settings/SettingsHeader";
import CustomCKEditor from "../../Assignment/CustomCKEditor";
import {
  postAssignment,
  StudentLeave,
} from "../../../services/api";
import { Center, Course } from "../../../types/trainer";
import { AssignmentFormErrors } from "../../../types/assignment";
import {
  StudentLeaveFormData,
  StudentLeaveFormErrors,
} from "../../../types/leave";
import { toast } from "sonner";

const allowedFileTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/pdf",
  "application/zip",
];
const StudentLeaveForm = ({
  openForm,
}: {
  openForm: (formName: string) => void;
}) => {
  const [formData, setFormData] = useState<StudentLeaveFormData>({
    course_id: 0,
    center_id: 0,
    tb_id: 0,
    sl_code: "",
    std_cnic: "",
    sl_date: "",
    sl_month: "",
    sl_subject: "",
    sl_status: 0,
    sl_body: "",
    sl_trainer_comments: "",
    sl_submit_date: "",
  });

  const [errors, setErrors] = useState<StudentLeaveFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { selectedBatchId, user_id, userType, selectedBatchName } = useBatch();
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [isLoadingCenters, setIsLoadingCenters] = useState(false);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [trainerName, setTrainerName] = useState("");
  const [courseName, setCourseName] = useState("");
  const [centerName, setCenterName] = useState("");
  const STUDENT_DASHBOARD_CACHE_KEY = "studentDashboardData";
  const CACHE_DURATION = 24 * 60 * 60 * 1000; 
  const MAX_CACHE_ITEMS = 5; 
  const fetchStudentByUserId = async () => {
    try {
      if (userType === "student") {
        const cacheKey = `${STUDENT_DASHBOARD_CACHE_KEY}_${user_id}_${selectedBatchId}`;
        const cachedData = localStorage.getItem(cacheKey);

        if (cachedData) {
          const parsedData = JSON.parse(cachedData);
          const studentData = parsedData.data.studentProfilebyCNIC?.data;

          if (studentData) {
            setFormData((prev) => ({
              ...prev,
              std_cnic: studentData.std_cnic,
              course_id: studentData.course_id,
              center_id: studentData.center_id,
            }));
            setTrainerName("Trainer: ");
            setCourseName(studentData.course_full_name);
            setCenterName(studentData.center_name);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoadingCenters(false);
      setIsLoadingCourses(false);
    }
  };
  useEffect(() => {
    fetchStudentByUserId();
  }, [selectedBatchId]);


  const handleDescriptionChange = (content: string) => {
    setFormData((prev) => ({ ...prev, sl_body: content }));
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
  const generateSlCode = () => {
    return Math.floor(Math.random() * 900000000000 + 100000000000).toString();
  };
  function dateCustomFormatting(date: Date): string {
    const padStart = (value: number): string =>
      value.toString().padStart(2, "0");

    return `${padStart(date.getDate())}/${padStart(
      date.getMonth() + 1
    )}/${date.getFullYear()}`;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);

    try {
      formData.tb_id = selectedBatchId;
      formData.sl_month = new Date().toLocaleString("default", {
        month: "long",
      });

      const date = new Date();
      const dateFormat = dateCustomFormatting(date);
      formData.sl_submit_date = dateFormat;
      formData.sl_code = generateSlCode();
      const response = await StudentLeave(formData);
      // Reset form

      setFormData({
        course_id: 0,
        center_id: 0,
        tb_id: 0,
        sl_code: "",
        std_cnic: "",
        sl_date: "",
        sl_month: "",
        sl_subject: "",
        sl_status: 0,
        sl_body: "",
        sl_trainer_comments: "",
        sl_submit_date: "",
      });
      toast.success(response.data.message);
      openForm("StudentLeave");
    } catch (error) {
      console.error("Submission error:", error);
      alert("Error submitting leave application");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto p-3 sm:p-4 lg:p-6 bg-[hsl(var(--card))] rounded-lg shadow-[hsl(var(--border))] flex flex-col lg:flex-row gap-4">
      <div className="w-full lg:w-3/4">
        <SettingsHeader
          SettingsHeader="Apply for Leave Application"
          SettingDescription="Here you can officially apply for leave application. All applications need to be approved by the Trainer."
        />
        <div
          className="bg-[hsl(var(--accent)/0.1)] border border-[hsl(var(--accent))] text-[hsl(var(--foreground))] px-3 sm:px-4 py-2 sm:py-3 rounded relative mb-4 text-sm sm:text-base"
          role="alert"
        >
          <strong className="font-bold">Info!</strong>
          <span className="block sm:inline">
            {" "}
            You have 3 leave(s) remaining in this month. We allow max. 3 leaves
            in a month.
          </span>
        </div>

        <div className="mb-4 text-[hsl(var(--foreground))] text-sm sm:text-base">
          <strong>TO,</strong>
          <div>The {trainerName},</div>
          <div className="break-words">
            {courseName} - {centerName}
          </div>

          <div>DigiBizz Program {selectedBatchName}</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 items-start">
          {/* Leave Date */}
          <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
            <input
              type="date"
              name="sl_date"
              value={formData.sl_date}
              onChange={handleInputChange}
              className={`w-full sm:w-2/4 px-3 py-2 border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base`}
            />

            {errors.sl_date && (
              <p className="mt-1 text-sm text-red-600">{errors.sl_date}</p>
            )}
            <div
              className="bg-[hsl(var(--accent)/0.1)] border border-[hsl(var(--accent))] text-[hsl(var(--foreground))] px-3 sm:px-4 py-2 sm:py-3 rounded relative"
              role="alert"
            >
              <p className="text-xs sm:text-sm text-[hsl(var(--foreground))] mt-1">
                <strong>Note:</strong> If you want to take leave for more than 1
                consecutive days, then resubmit another application. Remember,
                you cannot apply for a leave for the current date.
              </p>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
              Subject
            </label>
            <input
              type="text"
              name="sl_subject"
              value={formData.sl_subject}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base`}
            />
            {errors.sl_subject && (
              <p className="mt-1 text-sm text-red-600">{errors.sl_subject}</p>
            )}
          </div>

          {/* Application Body */}

          <div className="form-group">
            <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
              Application Body
            </label>
            <textarea
              className="border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] rounded-lg w-full px-3 py-2 text-sm sm:text-base resize-y min-h-[120px]"
              rows={4}
              value={formData.sl_body}
              onChange={(e) => handleDescriptionChange(e.target.value)}
            />

            {errors.sl_body && (
              <p className="mt-1 text-sm text-red-600">{errors.sl_body}</p>
            )}
          </div>

          <div
            className="bg-[hsl(var(--accent)/0.1)] border border-[hsl(var(--accent))] text-[hsl(var(--foreground))] px-3 sm:px-4 py-2 sm:py-3 rounded relative mb-4 text-sm"
            role="alert"
          >
            <span className="block sm:inline">
              Do not include your name, cnic etc at the end of body. It will be
              added to your application automatically.
            </span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] py-2 sm:py-3 px-4 rounded hover:bg-[hsl(var(--primary)/0.9)] transition-colors text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </button>
        </form>
      </div>

      {/* Important Note Section */}
      <div className="w-full lg:w-1/4 bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] p-4 sm:p-5 rounded-lg">
        <h3 className="text-base sm:text-lg text-[hsl(var(--accent))] text-center font-bold mb-2">
          IMPORTANT TO NOTE:
        </h3>
        <ul className="list-disc pl-4 sm:pl-5 text-xs sm:text-sm space-y-1">
          <li>
            Submit your leave application well in advance of the intended leave
            date.
          </li>
          <li>
            Fill out all required fields on the leave application form
            accurately and completely.
          </li>
          <li>Provide a valid and compelling reason for requesting leave.</li>
          <li>
            Ensure that your leave application is legible and easy to
            understand.
          </li>
          <li>
            Abide by the DigiBizz's policies and guidelines for leave requests.
          </li>
          <li>
            Do not submit leave applications for frivolous or non-genuine
            reasons.
          </li>
          <li>
            Respect the decision of the Trainer regarding your leave request.
          </li>
          <li>
            Inform your classmates about your leave well in advance and catch up
            on missed work promptly upon your return.
          </li>
        </ul>
      </div>
    </div>
  );
};

export default StudentLeaveForm;
