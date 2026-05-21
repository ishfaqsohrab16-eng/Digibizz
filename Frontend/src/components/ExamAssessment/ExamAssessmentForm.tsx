import React, { useState, useEffect } from "react";
import {
  createExamAssessment,
  getExamAssessmentsByTbId,
  getStudentsByCNICProfile,
} from "../../services/api";
import {
  ExamAssessment,
  ExamAssessmentFormData,
} from "../../types/examAssessment";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { toast } from "sonner";
import SettingsHeader from "../../components/Settings/SettingsHeader";
import { Search } from "lucide-react";
import { useBatch } from "../../context/BatchContext";

interface StudentData {
  user_id: number;
  user_name: string;
  user_username: string;
  user_email: string;
  user_type: string;
  user_status: number;
  user_profile_photo: string;
  std_id: number;
  tb_id: number;
  center_id: number;
  course_id: number;
  center_name: string;
  course_name: string;
  std_cnic: string;
  std_gender: string;
  std_qualification: string;
  std_district: string;
  std_phone: string;
  std_fathername: string;
  std_lms_status: number;
  std_forum_status: number;
  std_rollno: string;
  attendanceProgress: number;
}

interface ExamAssessmentFormProps {
  initialData?: ExamAssessment | null;
  onSubmitSuccess?: () => void;
  onCancel?: () => void;
  mode?: "create" | "edit";
  type?: "MID" | "FINAL";
}

const ExamAssessmentForm: React.FC<ExamAssessmentFormProps> = ({
  initialData = null,
  onSubmitSuccess,
  onCancel,
  mode,
  type,
}) => {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  // Student search state
  const [searchCNIC, setSearchCNIC] = useState(initialData?.std_cnic || "");
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showProfile, setShowProfile] = useState(!!initialData?.std_cnic);
  const { latestSelectedBatch, userType } = useBatch();
  // Form state
  const [formData, setFormData] = useState<ExamAssessmentFormData>({
    std_cnic: initialData?.std_cnic || "",
    tb_id: initialData?.tb_id || 0,
    center_id: initialData?.center_id || 0,
    course_id: initialData?.course_id || 0,
    ea_type: type || initialData?.ea_type || "FINAL",
    class_participation: initialData?.class_participation || 0,
    final_task: initialData?.final_task || 0,
    presentation: initialData?.presentation || 0,
    viva: initialData?.viva || 0,
    remarks: initialData?.remarks || "",
  });
  const [loading, setLoading] = useState(false);
  const [totalScore, setTotalScore] = useState<number>(0);

  // Calculate total score whenever individual scores change
  useEffect(() => {
    let total = 0;
    if (type === "MID") {
      total =
        Number(formData.class_participation) +
        Number(formData.final_task) +
        Number(formData.presentation);
      // No viva in MID
    } else {
      total =
        Number(formData.class_participation) +
        Number(formData.final_task) +
        Number(formData.presentation) +
        Number(formData.viva);
    }
    setTotalScore(parseFloat(total.toFixed(1)));
  }, [
    formData.class_participation,
    formData.final_task,
    formData.presentation,
    formData.viva,
    type,
  ]);

  // If initialData is present, fetch student info on mount
  useEffect(() => {
    if (initialData?.std_cnic) {
      handleSearchStudent(initialData.std_cnic);
    }
    // eslint-disable-next-line
  }, []);

  // Format CNIC helper
  const formatCnic = (value: string) => {
    const cleanedValue = value.replace(/\D/g, "");
    const match = cleanedValue.match(/^(\d{0,5})(\d{0,7})(\d{0,1})$/);
    if (!match) return "";
    return [match[1], match[2], match[3]].filter(Boolean).join("-");
  };

  // Search student by CNIC
  const handleSearchStudent = async (cnicValue?: string) => {
    const cnic = cnicValue ?? searchCNIC;
    if (!cnic || cnic.length < 15) {
      toast.error("Please enter a valid CNIC (xxxxx-xxxxxxx-x)");
      return;
    }
    setIsSearching(true);
    try {
      const response = await getStudentsByCNICProfile(cnic);
      if (response.success) {
        if (response.data.tb_id !== latestSelectedBatch) {
          toast.error(
            `Student does not belong to the Current ${
              latestSelectedBatch
            } batch`
          );
        }
        setStudentData(response.data);
        setShowProfile(true);
        setFormData((prev) => ({
          ...prev,
          std_cnic: response.data.std_cnic,
        }));
        const examData = await getExamAssessmentsByTbId(
          response.data.tb_id,
          response.data.std_cnic,
          type || "FINAL"
        );
        if (examData?.success) {
          if (examData.data.length > 0) {
            const assessment = examData.data[0]; // Get the first assessment
            setFormData((prev) => ({
              ...prev,
              class_participation: Number(assessment.class_participation) || 0,
              final_task: Number(assessment.final_task) || 0,
              presentation: Number(assessment.presentation) || 0,
              viva: Number(assessment.viva) || 0,
              remarks: assessment.remarks || "",
            }));
          } else {
            // No assessment data found, reset to zero
            setFormData((prev) => ({
              ...prev,
              class_participation: 0,
              final_task: 0,
              presentation: 0,
              viva: 0,
              remarks: "",
            }));
          }
        }
      } else {
        setFormData((prev) => ({
          ...prev,
          class_participation: 0,
          final_task: 0,
          presentation: 0,
          viva: 0,
          remarks: "",
        }));
        setShowProfile(false);
        toast.error("Student not found");
      }
    } catch (error) {
      setStudentData(null);
      setShowProfile(false);
      toast.error("Failed to fetch student data");
    } finally {
      setIsSearching(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    if (
      ["class_participation", "final_task", "presentation", "viva"].includes(
        name
      )
    ) {
      // Accept empty string for controlled input, else clamp value
      if (value === "") {
        setFormData((prev) => ({
          ...prev,
          [name]: "",
        }));
      } else {
        const numValue = parseFloat(value);
        let max = 25;
        // Set max values based on exam type
        if (type === "MID") {
          if (name === "class_participation") max = 10;
          if (name === "final_task") max = 20;
          if (name === "presentation") max = 20;
          if (name === "viva") max = 0; // No viva for MID
        } else {
          if (name === "class_participation") max = 20;
          if (name === "presentation" || name === "final_task") max = 30;
          if (name === "viva") max = 20;
        }
        const limitedValue = Math.min(
          Math.max(isNaN(numValue) ? 0 : numValue, 0),
          max
        );
        setFormData((prev) => ({
          ...prev,
          [name]: limitedValue,
        }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentData) {
      toast.error("Please search and select a student first.");
      return;
    }
    setLoading(true);
    try {
      let response;
      const formDataToSubmit = {
        ...formData,
        std_cnic: studentData.std_cnic,
        tb_id: studentData.tb_id,
        center_id: studentData.center_id,
        course_id: studentData.course_id,
      };
      response = await createExamAssessment(formDataToSubmit);

      if (response.success) {
        toast.success(response.message || "Exam assessment saved successfully");
        if (onSubmitSuccess) {
          onSubmitSuccess();
        }
      } else {
        // Show error toast with API message if present
        toast.error(response.message || "Operation failed");
      }
    } catch (error: any) {
      // If error response contains the message, show it
      if (error?.response?.data?.message) {
        toast.error(error.response.data.message);
      } else if (error?.message) {
        toast.error(error.message);
      } else {
        toast.error("An error occurred while saving the exam assessment");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-8xl mx-auto p-6 bg-[hsl(var(--background))] rounded-lg shadow-md">
      <SettingsHeader
        SettingsHeader={
          mode === "create" ? "Create Exam Assessment" : "Edit Exam Assessment"
        }
        SettingDescription="Enter student exam assessment details"
      />

      {/* Search Student by CNIC */}
      <div className="w-full bg-[hsl(var(--card))] rounded-xl shadow p-6 mb-8 border border-[hsl(var(--border))]">
        <h2 className="text-lg font-bold text-[hsl(var(--foreground))] mb-4 text-center">
          Search Student by CNIC
        </h2>
        <div className="flex gap-3 mb-2">
          <Input
            type="text"
            placeholder="Enter CNIC (xxxxx-xxxxxxx-x)"
            value={searchCNIC}
            onChange={(e) => setSearchCNIC(formatCnic(e.target.value))}
            disabled={isSearching}
            maxLength={15}
            className="flex-1 px-4 py-2 border border-[hsl(var(--border))] rounded-md focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] text-[hsl(var(--foreground))] bg-[hsl(var(--card))] transition"
          />
          <Button
            type="button"
            onClick={() => handleSearchStudent()}
            disabled={isSearching || searchCNIC.length < 15}
            className="px-5 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-md hover:bg-[hsl(var(--accent))] transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {isSearching ? (
              <span className="animate-spin">
                <Search className="w-4 h-4" />
              </span>
            ) : (
              <Search className="w-4 h-4" />
            )}
            {isSearching ? "Searching..." : "Search"}
          </Button>
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))] text-center">
          Please enter the student's CNIC in the format: 12345-1234567-1
        </p>
      </div>

      {/* Only show the rest if student is found */}
      {showProfile && studentData && (
        <>
          <div className="w-full mb-8 bg-[hsl(var(--card))] rounded-xl shadow-lg border border-[hsl(var(--border))] p-8 flex flex-col items-center theme-transition">
            <div className="flex flex-col items-start mb-6">
              <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-[hsl(var(--primary))] shadow-md mb-3">
                <img
                  src={`${BACKEND_URL}${studentData.user_profile_photo}`}
                  alt={studentData.user_name}
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="text-lg font-bold text-[hsl(var(--foreground))] mb-1">
                {studentData.user_name}
              </h3>
              <span className="text-sm text-[hsl(var(--muted-foreground))]">
                {studentData.std_cnic}
              </span>
              <span className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                Roll No: {studentData.std_rollno}
              </span>
            </div>
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <div className="font-semibold text-[hsl(var(--foreground))] mb-1">
                  Father Name
                </div>
                <div className="text-[hsl(var(--muted-foreground))] mb-2">
                  {studentData.std_fathername}
                </div>
                <div className="font-semibold text-[hsl(var(--foreground))] mb-1">
                  Email
                </div>
                <div className="text-[hsl(var(--muted-foreground))] mb-2">
                  {studentData.user_email}
                </div>
                <div className="font-semibold text-[hsl(var(--foreground))] mb-1">
                  Phone
                </div>
                <div className="text-[hsl(var(--muted-foreground))]">
                  {studentData.std_phone}
                </div>
              </div>
              <div>
                <div className="font-semibold text-[hsl(var(--foreground))] mb-1">
                  Qualification
                </div>
                <div className="text-[hsl(var(--muted-foreground))] mb-2">
                  {studentData.std_qualification || "N/A"}
                </div>
                <div className="font-semibold text-[hsl(var(--foreground))] mb-1">
                  Center
                </div>
                <div className="text-[hsl(var(--muted-foreground))]">
                  {studentData.center_name}
                </div>
                <div className="font-semibold text-[hsl(var(--foreground))] mb-1">
                  Course
                </div>
                <div className="text-[hsl(var(--muted-foreground))]">
                  {studentData.course_name}
                </div>
                <div className="font-semibold text-[hsl(var(--foreground))] mb-1">
                  Attendance Progress
                </div>
                <div className="text-[hsl(var(--muted-foreground))]">
                  {studentData.attendanceProgress} %
                </div>
                {/* Move status badge here */}
                <div className="mt-6 flex justify-start">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                      studentData.user_status === 1
                        ? "bg-[hsl(var(--teal))] text-[hsl(var(--primary-foreground))]"
                        : "bg-[hsl(var(--pink))] text-[hsl(var(--primary-foreground))]"
                    }`}
                  >
                    {studentData.user_status === 1 ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Assessment Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Hide std_cnic input, use studentData.std_cnic */}
            <input
              type="hidden"
              name="std_cnic"
              value={studentData?.std_cnic || ""}
            />
            {/* Exam Type */}
            <div className="space-y-2">
              <label className="block text-[hsl(var(--foreground))] font-medium">
                Exam Type
              </label>
              <div className="w-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-md px-4 py-2 text-[hsl(var(--foreground))] font-semibold text-base">
                {type === "MID" ? "Mid-Term" : "Final"}
              </div>
            </div>
            <div className="mt-8">
              <h3 className="text-xl font-bold border-b pb-2 mb-4 text-[hsl(var(--foreground))]">
                Assessment Scores
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {/* Class Participation */}
                <div className="space-y-2">
                  <label className="block text-[hsl(var(--foreground))] font-bold text-lg">
                    Class Participation
                  </label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      name="class_participation"
                      value={formData.class_participation}
                      onChange={handleInputChange}
                      min="0"
                      max={type === "MID" ? "10" : "20"}
                      step="0.5"
                      required
                      className="w-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-xl font-bold"
                    />
                    <span className="text-base text-[hsl(var(--muted-foreground))] font-bold">
                      ({type === "MID" ? "10" : "20"})
                    </span>
                  </div>
                </div>
                {/* Final Task */}
                <div className="space-y-2">
                  <label className="block text-[hsl(var(--foreground))] font-bold text-lg">
                    {type} Task
                  </label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      name="final_task"
                      value={formData.final_task}
                      onChange={handleInputChange}
                      min="0"
                      max={type === "MID" ? "20" : "30"}
                      step="0.5"
                      required
                      className="w-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-xl font-bold"
                    />
                    <span className="text-base text-[hsl(var(--muted-foreground))] font-bold">
                      ({type === "MID" ? "20" : "30"})
                    </span>
                  </div>
                </div>
                {/* Presentation */}
                <div className="space-y-2">
                  <label className="block text-[hsl(var(--foreground))] font-bold text-lg">
                    Presentation
                  </label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      name="presentation"
                      value={formData.presentation}
                      onChange={handleInputChange}
                      min="0"
                      max={type === "MID" ? "20" : "30"}
                      step="0.5"
                      required
                      className="w-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-xl font-bold"
                    />
                    <span className="text-base text-[hsl(var(--muted-foreground))] font-bold">
                      ({type === "MID" ? "20" : "30"})
                    </span>
                  </div>
                </div>
                {/* Viva - Only show for FINAL exam type */}
                {type !== "MID" && (
                  <div className="space-y-2">
                    <label className="block text-[hsl(var(--foreground))] font-bold text-lg">
                      Viva
                    </label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        name="viva"
                        value={formData.viva}
                        onChange={handleInputChange}
                        max="20"
                        step="0.5"
                        required
                        className="w-full bg-[hsl(var(--card))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-xl font-bold"
                      />
                      <span className="text-base text-[hsl(var(--muted-foreground))] font-bold">
                        (20)
                      </span>
                    </div>
                  </div>
                )}
              </div>
              {/* Total Score (Calculated) */}
              <div className="mt-6 p-4 bg-[hsl(var(--muted))] rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-[hsl(var(--foreground))] font-medium">
                    Total Score:
                  </span>
                  <span className="text-xl font-semibold text-[hsl(var(--teal))]">
                    {totalScore} / {type === "MID" ? "50" : "100"}
                  </span>
                </div>
              </div>
            </div>
            {/* Remove Remarks */}
            <div className="flex justify-end space-x-4 mt-6">
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  className="border-[hsl(var(--border))] text-[hsl(var(--foreground))]"
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))] text-[hsl(var(--primary-foreground))]"
                disabled={
                  loading ||
                  !studentData ||
                  (studentData.tb_id !== latestSelectedBatch &&
                    
                    userType !== "ContentAdmin" && userType !== "SuperAdmin" && userType !== "MasterTrainer")
                }
              >
                {loading
                  ? "Saving..."
                  : studentData.tb_id !== latestSelectedBatch &&
              
                    userType !== "ContentAdmin" && userType !== "SuperAdmin" && userType !== "MasterTrainer"
                  ? "Student Not in Current Batch"
                  : "Submit Assessment Marks"}
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};

export default ExamAssessmentForm;
