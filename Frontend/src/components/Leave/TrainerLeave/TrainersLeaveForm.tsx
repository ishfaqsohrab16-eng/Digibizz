import React, { useState, useEffect } from "react";
import { useBatch } from "../../../context/BatchContext";

import CustomCKEditor from "../../Assignment/CustomCKEditor";
import {
  getAllCourse,
  getCenter,
  getStudentsProfile,
  getTrainersProfile,
  getTrainersProfileByUser,
  postAssignment,
  StudentLeave,
  TrainerLeave,
} from "../../../services/api";
import { Center, Course } from "../../../types/trainer";
import { AssignmentFormErrors } from "../../../types/assignment";
import {
  StudentLeaveFormData,
  StudentLeaveFormErrors,
  TrainersLeaveFormData,
  TrainersLeaveFormErrors,
} from "../../../types/leave";
import { toast } from "sonner";
import SettingsHeader from "../../Settings/SettingsHeader";

const allowedFileTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/pdf",
  "application/zip",
];
const TrainerLeaveForm = ({
  openForm,
}: {
  openForm: (formName: string) => void;
}) => {
  const [formData, setFormData] = useState<TrainersLeaveFormData>({
    course_id: 0,
    center_id: 0,
    tb_id: 0,
    t_id: 0,
    tl_code: "",
    tl_subject: "",
    tl_body: "",
    tl_status: 0,
    tl_submit_date: "",
    tl_date: "",
    tl_month: "",
    tl_mt_comments: "",
    tl_admin_comments: "",
  });

  const [errors, setErrors] = useState<TrainersLeaveFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // You'll need to fetch these from your API
  const [course, setCourse] = useState<Course[]>([]);
  const [center, setCenter] = useState<Center[]>([]);
  const [trainingBatches, setTrainingBatches] = useState([]);
  const {
    selectedBatchId,
    user_id,
    userType,
    selectedBatchName,
    center_id,
    course_id,
  } = useBatch();
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  // Add loading states for centers and courses
  const [isLoadingCenters, setIsLoadingCenters] = useState(false);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [trainerName, setTrainerName] = useState("");
  const [courseName, setCourseName] = useState("");
  const [centerName, setCenterName] = useState("");
  const fetchStudentByUserId = async () => {
    try {
      if (userType === "trainer") {
        const response = await getTrainersProfileByUser(
          selectedBatchId,
          center_id,
          user_id
        );
        const TrainerData = response.data[0];

        setFormData((prev) => ({
          ...prev,
          t_id: TrainerData.t_id,
          course_id: TrainerData.t_course_id,
          center_id: TrainerData.t_center_id,
        }));
        setTrainerName(TrainerData.master_trainer_name);

        setCourseName(TrainerData.course_name);
        setCenterName(TrainerData.center_name);
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
  const handleDescriptionChange = (content: string) => {
    setFormData((prev) => ({ ...prev, tl_body: content }));
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
  const generateSlCode = () => {
    return Math.floor(Math.random() * 900000000000 + 100000000000).toString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);

    try {
      formData.tb_id = selectedBatchId;
      formData.tl_month = new Date().toLocaleString("default", {
        month: "long",
      });
      formData.tl_submit_date = new Date().toLocaleString();
      formData.tl_code = generateSlCode();
      formData.course_id = course_id;
      const response = await TrainerLeave(formData);
      // Reset form

      setFormData({
        course_id: 0,
        center_id: 0,
        tb_id: 0,
        t_id: 0,
        tl_code: "",
        tl_subject: "",
        tl_body: "",
        tl_status: 0,
        tl_submit_date: "",
        tl_date: "",
        tl_month: "",
        tl_mt_comments: "",
        tl_admin_comments: "",
      });
      setProfilePhoto(null);
      toast.success(response.data.message);
    } catch (error) {
      console.error("Submission error:", error);
      alert("Error submitting leave application");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto p-6 bg-[hsl(var(--card))] rounded-lg shadow-[hsl(var(--border))] flex">
      <div className="w-3/4">
        <SettingsHeader
          SettingsHeader="Apply for Leave Application"
          SettingDescription="All applications required to be approved by both authorities: Master Trainer & Administration."
        />
        <div
          className="bg-[hsl(var(--accent)/0.1)] border border-[hsl(var(--accent))] text-[hsl(var(--foreground))] px-4 py-3 rounded relative mb-4"
          role="alert"
        >
          <strong className="font-bold">Info!</strong>
          <span className="block sm:inline">
            {" "}
            You have 2 leave(s) remaining in this month. We allow max. 2 leaves
            in a month.
          </span>
        </div>

        <div className="mb-4 text-[hsl(var(--foreground))]">
          <strong>TO,</strong>
          <div>The {trainerName},</div>
          <div>
            {courseName} - {centerName}
          </div>

          <div>DigiBizz Program {selectedBatchName}</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 items-start">
          {/* Leave Date */}
          <div className="flex justify-between">
            <input
              type="date"
              name="tl_date"
              value={formData.tl_date}
              onChange={handleInputChange}
              className={`w-2/4 mr-5 px-3 py-2 border ${
                errors.tl_date ? "border-red-500" : "border-gray-300"
              } rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
            />

            {errors.tl_date && (
              <p className="mt-1 text-sm text-red-600">{errors.tl_date}</p>
            )}

            <div
              className="bg-blue-100 border border-blue-400 text-orange-700 px-4 py-3 rounded relative mb-4"
              role="alert"
            >
              <p className="text-s text-blue-500 mt-1">
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
              name="tl_subject"
              value={formData.tl_subject}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border ${
                errors.tl_subject ? "border-red-500" : "border-gray-300"
              } rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]`}
            />

            {errors.tl_subject && (
              <p className="mt-1 text-sm text-red-600">{errors.tl_subject}</p>
            )}
          </div>

          {/* Application Body */}

          <div className="form-group">
            <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1">
              Application Body
            </label>
            <textarea
              className="border border-gray-300 rounded-lg w-full px-3 py-2 border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
              rows={10}
              value={formData.tl_body}
              onChange={(e) => handleDescriptionChange(e.target.value)}
            />

            {errors.tl_body && (
              <p className="mt-1 text-sm text-red-600">{errors.tl_body}</p>
            )}
          </div>

          <div
            className="bg-orange-100 border border-orange-400 text-orange-700 px-4 py-3 rounded relative mb-4"
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
            className="w-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary)/0.9)]"
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </button>
        </form>
      </div>

      {/* Important Note Section */}
      <div className="w-1/4 h-1/2 bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] p-5 m-5 rounded-lg">
        <h3 className="text-lg text-orange-400 text-center font-bold mb-2">
          IMPORTANT TO NOTE:
        </h3>
        <ul className="list-disc pl-5">
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

export default TrainerLeaveForm;
