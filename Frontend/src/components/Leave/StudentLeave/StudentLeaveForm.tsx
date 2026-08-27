import React, { useState, useEffect } from "react";
import { useBatch } from "../../../context/BatchContext";
import { getStudendByUserId } from "../../../services/api";
import SettingsHeader from "../../Settings/SettingsHeader";
import CustomCKEditor from "../../Assignment/CustomCKEditor";
import { StudentLeave } from "../../../services/api";
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
  /**
   * Load the student's own course and center, for display.
   *
   * This used to read ONLY from a localStorage cache and silently do nothing
   * when it was absent - on a new device, after clearing site data, or simply
   * before the dashboard had ever been opened. The identity fields then stayed
   * empty and every submission came back "Missing required fields", which is
   * the error students were seeing.
   *
   * The cache is now just a fast path; the API is the fallback. The server
   * derives the real identity from the signed-in user either way, so these
   * values are cosmetic and a failure here no longer blocks submitting.
   */
  const applyStudent = (studentData: any) => {
    if (!studentData) return false;
    setFormData((prev) => ({
      ...prev,
      std_cnic: studentData.std_cnic ?? prev.std_cnic,
      course_id: studentData.course_id ?? prev.course_id,
      center_id: studentData.center_id ?? prev.center_id,
    }));
    setTrainerName("Trainer: ");
    setCourseName(studentData.course_full_name || studentData.course_name || "");
    setCenterName(studentData.center_name || "");
    return true;
  };

  const fetchStudentByUserId = async () => {
    if (userType !== "student" || !user_id) {
      setIsLoadingCenters(false);
      setIsLoadingCourses(false);
      return;
    }

    setIsLoadingCenters(true);
    setIsLoadingCourses(true);

    try {
      const cacheKey = `${STUDENT_DASHBOARD_CACHE_KEY}_${user_id}_${selectedBatchId}`;
      const cachedData = localStorage.getItem(cacheKey);

      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          if (applyStudent(parsed?.data?.studentProfilebyCNIC?.data)) return;
        } catch {
          // A corrupt cache entry must not stop the API fallback below.
          localStorage.removeItem(cacheKey);
        }
      }

      const response = await getStudendByUserId(user_id);
      applyStudent(response?.data ?? response);
    } catch (error) {
      console.error("Error loading your profile:", error);
      toast.error(
        "Could not load your course and center details. You can still submit - they are taken from your account."
      );
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
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);

    try {
      // The server now derives the student, batch, center, course, code,
      // month and submit date from the signed-in account, so only the leave
      // itself is sent. Supplying them here was what made the form dependent
      // on a cache that is often not there.
      const response = await StudentLeave({
        ...formData,
        tb_id: selectedBatchId,
      });
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
      toast.success(
        response?.data?.message || "Leave application submitted"
      );
      openForm("StudentLeave");
    } catch (error: any) {
      console.error("Submission error:", error);
      // handleApiError already unwraps the server's message, so this shows the
      // real reason - already applied for that date, monthly limit reached,
      // enrolment incomplete - instead of a generic failure.
      const errorMessage =
        error?.response?.data?.message ||
        (error instanceof Error
          ? error.message
          : "Could not submit your leave application");
      toast.error(errorMessage);
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
