import React, { useState, useEffect } from "react";
import {
  registerCandidate,
  getCenter,
  getAllCourse,
  getPublicAdmissionControl,
} from "../../../services/api";
import { CandidateFormData } from "../../../types/registration";
import PersonalInformation from "./PersonalInformation";
import AcademicInformation from "./AcademicInformation";
import ContactInformation from "./ContactInformation";
import DigiBizzCenterSelection from "./CenterSelection";
import CourseTrackSelection from "./CourseTrackSelection";
import AgreementPolicy from "./AgreementPolicy";
import logo from "../../../assets/logo.png";
import { toast } from "sonner";

interface RegistrationDetailsProps {
  cnicNo: string;
  handleNext: (test: number, name?: string) => void;
  isIttiRegistration?: boolean;
  batchId: number;
}
const today = new Date();
const formattedToday = today.toISOString().split("T")[0]; // Extract only the date part (YYYY-MM-DD)

const initialFormData: CandidateFormData = {
  cand_id: 0,
  cand_cnic: "",
  cand_name: "",
  cand_fathername: "",
  tb_id: 9,
  course_id: 0,
  center_id: 0,
  cand_email: "",
  confirm_email: "",
  cand_phone: "",
  confirm_phone: "",
  cand_whatsapp: "",
  guardian_whatsapp: "",
  cand_gender: "",
  cand_dob: "",
  cand_local_domicile: "",
  cand_degree_level: "",
  degree_area: "",
  institute: "",
  degree_start_date: "",
  degree_end_date: "",
  current_address: "",
  permanent_address: "",
  current_city: "",
  permanent_city: "",
  cand_test_code: "",
  cand_test_marks: 0,
  cand_interview_marks: "",
  cand_admission_status: 0,
  cand_apply_date: formattedToday, // Use the formatted date
  reject_reason: "",
  laptop_pc: "",
  recommended: "",
  course_second_priority: 0,
  center_second_priority: 0,
  interview_date: "",
  where_find_us: "",
};

const RegistrationDetails: React.FC<RegistrationDetailsProps> = ({
  handleNext,
  cnicNo,
  isIttiRegistration = false,
  batchId,
}) => {
  const [formData, setFormData] = useState<CandidateFormData>(initialFormData);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  useEffect(() => {
    if (batchId) {
      setFormData((prev) => ({ ...prev, tb_id: batchId }));
    }
  }, [batchId]);

  const [center, setCenters] = useState<
    { center_id: number; center_name: string }[]
  >([]);
  const [course, setCourses] = useState<
    { course_id: number; course_full_name: string }[]
  >([]);
  const [admissionRules, setAdmissionRules] = useState<
    Array<{ center_id: number; course_id: number; allowed_gender: "all" | "male" | "female" }>
  >([]);
  const fetchData = async () => {
    try {
      const [centersData, coursesData, admissionData] = await Promise.all([
        getCenter(),
        getAllCourse(),
        getPublicAdmissionControl(batchId),
      ]);

      setCenters(centersData);
      setCourses(coursesData);
      setAdmissionRules(admissionData?.rules || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };
  useEffect(() => {
    fetchData();
  }, [batchId]);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    // Profile photo validation
    if (!profilePhoto) {
      newErrors.profilePhoto = "Profile photo is required";
      toast.error("Please upload your profile photo");
    } else if (!["image/jpeg", "image/png"].includes(profilePhoto.type)) {
      newErrors.profilePhoto = "Only JPEG and PNG files are allowed";
      toast.error("Profile photo must be in JPEG or PNG format");
    } else if (profilePhoto.size > 2 * 1024 * 1024) {
      newErrors.profilePhoto = "File size must be less than 2MB";
      toast.error("Profile photo must be less than 2MB");
    }

    // Email validation
    if (!formData.cand_email) {
      newErrors.cand_email = "Email is required";
      toast.error("Please enter your email address");
    } else if (formData.cand_email !== formData.confirm_email) {
      newErrors.cand_email = "Email addresses do not match";
      toast.error("Email addresses do not match");
    }

    // Phone validation
    if (!formData.cand_phone) {
      newErrors.cand_phone = "Phone number is required";
      toast.error("Please enter your phone number");
    } else if (formData.cand_phone !== formData.confirm_phone) {
      newErrors.cand_phone = "Phone numbers do not match";
      toast.error("Phone numbers do not match");
    }

    // Required fields validation with toast messages
    const requiredFields = {
      cand_name: "Full name",
      cand_dob: "Date of birth",
      cand_fathername: "Father's name",
      cand_gender: "Gender",
      cand_degree_level: "Degree level",
      center_id: "Center",
      course_id: "Course",
      cand_whatsapp: "WhatsApp number",
      guardian_whatsapp: "Guardian's WhatsApp number",
      cand_local_domicile: "Local domicile",
      degree_area: "Degree area",
      institute: "Institute",
      current_address: "Current address",
      permanent_address: "Permanent address",
      current_city: "Current city",
      permanent_city: "Permanent city",
      where_find_us: "Where did you find us",
    };

    Object.entries(requiredFields).forEach(([field, label]) => {
      if (!formData[field as keyof CandidateFormData]) {
        newErrors[field] = `${label} is required`;
        toast.error(`Please enter your ${label.toLowerCase()}`);
      }
    });

    // Date validations
    if (formData.degree_start_date && formData.degree_end_date) {
      if (new Date(formData.degree_start_date) > new Date(formData.degree_end_date)) {
        newErrors.degree_end_date = "End date cannot be earlier than start date";
        toast.error("Degree end date cannot be earlier than start date");
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProfilePhoto(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    const selectedRule = admissionRules.find(
      (rule) =>
        Number(rule.center_id) === Number(formData.center_id) &&
        Number(rule.course_id) === Number(formData.course_id)
    );

    if (!selectedRule) {
      toast.error("Admissions are closed for selected center/course.");
      setIsSubmitting(false);
      return;
    }

    if (
      selectedRule.allowed_gender !== "all" &&
      selectedRule.allowed_gender !== String(formData.cand_gender).toLowerCase()
    ) {
      toast.error(
        `Selected center allows only ${selectedRule.allowed_gender} candidates for this course.`
      );
      setIsSubmitting(false);
      return;
    }

    e.preventDefault();

    if (!validateForm()) {
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await registerCandidate(
        { ...formData, cand_apply_date: formattedToday }, // Ensure the formatted date is sent
        profilePhoto || undefined
      );

      if (response?.status === 201) {
        const candName = formData.cand_name;
        setFormData((prev) => ({
          ...initialFormData,
          tb_id: batchId,
        }));
        setProfilePhoto(null); // Reset file input
        handleNext(1, candName);
        toast.success("Registration successful!");
      } else {
        toast.error("Registration failed. Please try again.");
      }
    } catch (error) {
      console.error("Registration error:", error);
      toast.error("Registration failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, type, value } = e.target;
    setFormData((prev) => {
      const next = {
        ...prev,
        [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
      };

      const selectedGender = String(next.cand_gender || "").toLowerCase();
      const selectedCenter = Number(next.center_id);

      if (name === "cand_gender" || name === "center_id") {
        const centerAllowed = admissionRules.some(
          (rule) =>
            Number(rule.center_id) === selectedCenter &&
            (rule.allowed_gender === "all" || rule.allowed_gender === selectedGender)
        );
        if (!centerAllowed) {
          next.center_id = 0;
          next.course_id = 0;
          return next;
        }
      }

      const courseAllowed = admissionRules.some(
        (rule) =>
          Number(rule.center_id) === Number(next.center_id) &&
          Number(rule.course_id) === Number(next.course_id) &&
          (rule.allowed_gender === "all" || rule.allowed_gender === selectedGender)
      );

      if (!courseAllowed) {
        next.course_id = 0;
      }

      return next;
    });
  };

  return (
    <div className="bg-white min-h-screen">
      <div className="bg-green-700 text-white text-center py-2 px-4 text-sm sm:text-base">
        For Admissions Help:{" "}
        <a
          href="mailto:support@digibizz.gob.pk"
          className="underline hover:text-gray-200"
        >
          support@digibizz.gob.pk
        </a>
      </div>

      <div className="flex justify-center mt-4 px-4">
        <img
          src={logo}
          alt="Digibizz Balochistan Logo"
          className="h-16 sm:h-24"
        />
      </div>

      <div className="flex justify-center items-center p-4 sm:p-6 md:p-8">
        <div className="bg-white border border-gray-300 rounded-md shadow-md w-full max-w-6xl">
          <div className="bg-green-700 text-white text-center py-3 rounded-t-md px-4">
            <h2 className="text-lg sm:text-xl font-semibold">
              Batch-9 Admission Undertaking & Registration
            </h2>
          </div>

          <div className="flex justify-center items-center">
            <div className="bg-gray-50 p-4 sm:p-6 md:p-8 rounded shadow-md w-full">
              <div className="bg-blue-100 p-3 sm:p-4 rounded-md mb-4">
                <p className="text-xs sm:text-sm">
                  <span className="font-semibold">
                    <b>Important:</b>
                  </span>{" "}
                  Make sure the information provided is correct.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-6 md:gap-8">
                  <PersonalInformation
                    formData={formData}
                    errors={errors}
                    handleInputChange={handleInputChange}
                    handleFileChange={handleFileChange}
                    profilePhoto={profilePhoto}
                    cnicNo={cnicNo}
                    selectedCenterId={Number(formData.center_id)}
                    admissionRules={admissionRules}
                  />
                  <AcademicInformation
                    formData={formData}
                    errors={errors}
                    handleInputChange={handleInputChange}
                  />
                  <ContactInformation
                    formData={formData}
                    errors={errors}
                    handleInputChange={handleInputChange}
                  />
                  <DigiBizzCenterSelection
                    formData={formData}
                    errors={errors}
                    handleInputChange={handleInputChange}
                    center={center}
                    isIttiRegistration={isIttiRegistration}
                    admissionRules={admissionRules}
                  />
                  <CourseTrackSelection
                    formData={formData}
                    errors={errors}
                    handleInputChange={handleInputChange}
                    course={course}
                    admissionRules={admissionRules}
                  />
                  <AgreementPolicy errors={errors} />
                </div>

                <div className="mt-6 sm:mt-8">
                  <button
                    type="submit"
                    className="bg-orange-500 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full disabled:opacity-50 text-sm sm:text-base transition-colors duration-200"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Submitting..." : "Submit"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrationDetails;
