import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { ArrowLeft, ArrowRight, Check, Save } from "lucide-react";

interface RegistrationDetailsProps {
  cnicNo: string;
  handleNext: (test: number, name?: string) => void;
  isIttiRegistration?: boolean;
  batchId: number;
  batchName?: string;
  /** Present when the applicant used a center's dedicated apply link. */
  lockedCenter?: { center_id: number; center_name: string } | null;
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
  cand_phone: "",
  cand_whatsapp: "",
  cand_gender: "",
  cand_dob: "",
  cand_local_domicile: "",
  cand_degree_level: "",
  degree_area: "",
  institute: "",
  current_address: "",
  current_city: "",
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

const STEPS = [
  {
    key: "personal",
    label: "Personal",
    title: "Personal information",
    subtitle: "Enter your details exactly as they appear on your CNIC / B-Form.",
    nextLabel: "Continue to contact details",
  },
  {
    key: "contact",
    label: "Contact",
    title: "Contact information",
    subtitle:
      "All updates are sent to this email and WhatsApp number, so double-check them.",
    nextLabel: "Continue to academic information",
  },
  {
    key: "academic",
    label: "Academic",
    title: "Academic information",
    subtitle: "Enter your highest completed qualification.",
    nextLabel: "Continue to center selection",
  },
  {
    key: "center",
    label: "Center",
    title: "DigiBizz center selection",
    subtitle: "Pick the center you can travel to for the class timings shown below.",
    nextLabel: "Continue to course track",
  },
  {
    key: "course",
    label: "Course track",
    title: "Course track selection",
    subtitle: "Only the tracks currently open at your center are listed.",
    nextLabel: "Continue to agreement",
  },
  {
    key: "agreement",
    label: "Agreement",
    title: "Agreement & policy",
    subtitle: "Read the terms and confirm before submitting your application.",
    nextLabel: "Submit application",
  },
] as const;

const draftKey = (cnic: string) =>
  `digibizz_registration_draft_v1_${String(cnic).replace(/\D/g, "")}`;

const savedAgo = (timestamp: number | null) => {
  if (!timestamp) return "";
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
};

const RegistrationDetails: React.FC<RegistrationDetailsProps> = ({
  handleNext,
  cnicNo,
  isIttiRegistration = false,
  batchId,
  batchName,
  lockedCenter = null,
}) => {
  const [formData, setFormData] = useState<CandidateFormData>({
    ...initialFormData,
    cand_cnic: cnicNo,
    center_id: lockedCenter?.center_id || 0,
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  // Confirmed with an emailed code. Blocks the contact step rather than only
  // the final submit, so the applicant fixes a mistyped address while they are
  // still looking at it - the interview call-up goes to this address.
  const [emailVerified, setEmailVerified] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [maxStepReached, setMaxStepReached] = useState(0);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [, forceClockTick] = useState(0);
  const draftLoaded = useRef(false);

  const [center, setCenters] = useState<
    { center_id: number; center_name: string }[]
  >([]);
  const [course, setCourses] = useState<
    { course_id: number; course_full_name: string }[]
  >([]);
  const [admissionRules, setAdmissionRules] = useState<
    Array<{ center_id: number; course_id: number; allowed_gender: "all" | "male" | "female" }>
  >([]);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);

  useEffect(() => {
    if (batchId) {
      setFormData((prev) => ({ ...prev, tb_id: batchId }));
    }
  }, [batchId]);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, cand_cnic: cnicNo }));
  }, [cnicNo]);

  useEffect(() => {
    if (lockedCenter) {
      setFormData((prev) => ({ ...prev, center_id: lockedCenter.center_id }));
    }
  }, [lockedCenter]);

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

  // ---- Draft autosave -------------------------------------------------
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(draftKey(cnicNo));
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft?.formData) {
          setFormData((prev) => ({
            ...prev,
            ...draft.formData,
            cand_cnic: cnicNo,
            tb_id: batchId || prev.tb_id,
            center_id: lockedCenter?.center_id || draft.formData.center_id || 0,
          }));
          setAgreeToTerms(Boolean(draft.agreeToTerms));
          setStepIndex(Math.min(Number(draft.stepIndex) || 0, STEPS.length - 1));
          setMaxStepReached(Math.min(Number(draft.maxStepReached) || 0, STEPS.length - 1));
          setSavedAt(Number(draft.savedAt) || null);
        }
      }
    } catch (error) {
      console.error("Could not restore saved draft:", error);
    } finally {
      draftLoaded.current = true;
    }
    // Restoring once per CNIC is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cnicNo]);

  useEffect(() => {
    if (!draftLoaded.current) return;

    const timer = window.setTimeout(() => {
      try {
        const timestamp = Date.now();
        window.localStorage.setItem(
          draftKey(cnicNo),
          JSON.stringify({
            formData,
            agreeToTerms,
            stepIndex,
            maxStepReached,
            savedAt: timestamp,
          })
        );
        setSavedAt(timestamp);
      } catch (error) {
        console.error("Could not save draft:", error);
      }
    }, 800);

    return () => window.clearTimeout(timer);
  }, [formData, agreeToTerms, stepIndex, maxStepReached, cnicNo]);

  // Keeps the "Draft saved ..." label honest without re-saving.
  useEffect(() => {
    const interval = window.setInterval(() => forceClockTick((tick) => tick + 1), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const clearDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(draftKey(cnicNo));
    } catch (error) {
      console.error("Could not clear draft:", error);
    }
  }, [cnicNo]);

  // ---- Validation -----------------------------------------------------
  const validateStep = (index: number) => {
    const stepErrors: { [key: string]: string } = {};
    const requireAll = (fields: Record<string, string>) => {
      Object.entries(fields).forEach(([field, label]) => {
        if (!formData[field as keyof CandidateFormData]) {
          stepErrors[field] = `${label} is required`;
        }
      });
    };

    switch (STEPS[index].key) {
      case "personal": {
        requireAll({
          cand_name: "Full name",
          cand_dob: "Date of birth",
          cand_fathername: "Father's name",
          cand_gender: "Gender",
          cand_local_domicile: "Local domicile",
        });
        if (!profilePhoto) {
          stepErrors.profilePhoto = "Profile photo is required";
        } else if (!["image/jpeg", "image/png"].includes(profilePhoto.type)) {
          stepErrors.profilePhoto = "Only JPEG and PNG files are allowed";
        } else if (profilePhoto.size > 2 * 1024 * 1024) {
          stepErrors.profilePhoto = "File size must be less than 2MB";
        }
        break;
      }
      case "contact": {
        requireAll({
          cand_email: "Email address",
          cand_phone: "Phone number",
          cand_whatsapp: "WhatsApp number",
          current_address: "Current address",
          current_city: "Current city",
          where_find_us: "Where did you find us",
        });
        if (formData.cand_email && !emailVerified) {
          stepErrors.cand_email =
            "Please confirm your email address with the code we sent";
        }
        break;
      }
      case "academic": {
        requireAll({
          cand_degree_level: "Degree level",
          institute: "Institute",
          degree_area: "Degree area",
        });
        break;
      }
      case "center": {
        if (!formData.center_id) stepErrors.center_id = "Center is required";
        break;
      }
      case "course": {
        if (!formData.course_id) stepErrors.course_id = "Course is required";
        break;
      }
      case "agreement": {
        if (!agreeToTerms) {
          stepErrors.agreeToTerms = "Please accept the terms and program policy";
        }
        break;
      }
    }

    return stepErrors;
  };

  const firstInvalidStep = () => {
    for (let index = 0; index < STEPS.length; index += 1) {
      if (Object.keys(validateStep(index)).length > 0) return index;
    }
    return -1;
  };

  const goToStep = (index: number) => {
    setStepIndex(index);
    setMaxStepReached((prev) => Math.max(prev, index));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleContinue = () => {
    const stepErrors = validateStep(stepIndex);
    setErrors(stepErrors);

    if (Object.keys(stepErrors).length > 0) {
      toast.error(Object.values(stepErrors)[0]);
      return;
    }

    if (stepIndex < STEPS.length - 1) {
      goToStep(stepIndex + 1);
    }
  };

  const handleBack = () => {
    if (stepIndex === 0) return;
    setErrors({});
    goToStep(stepIndex - 1);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProfilePhoto(e.target.files[0]);
      setErrors((prev) => ({ ...prev, profilePhoto: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (stepIndex < STEPS.length - 1) {
      handleContinue();
      return;
    }

    const invalidStep = firstInvalidStep();
    if (invalidStep !== -1) {
      const stepErrors = validateStep(invalidStep);
      setErrors(stepErrors);
      goToStep(invalidStep);
      toast.error(Object.values(stepErrors)[0]);
      return;
    }

    const selectedRule = admissionRules.find(
      (rule) =>
        Number(rule.center_id) === Number(formData.center_id) &&
        Number(rule.course_id) === Number(formData.course_id)
    );

    if (!selectedRule) {
      toast.error("Admissions are closed for selected center/course.");
      return;
    }

    if (
      selectedRule.allowed_gender !== "all" &&
      selectedRule.allowed_gender !== String(formData.cand_gender).toLowerCase()
    ) {
      toast.error(
        `Selected center allows only ${selectedRule.allowed_gender} candidates for this course.`
      );
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
        clearDraft();
        setFormData({
          ...initialFormData,
          tb_id: batchId,
          cand_cnic: cnicNo,
          center_id: lockedCenter?.center_id || 0,
        });
        setProfilePhoto(null); // Reset file input
        setAgreeToTerms(false);
        toast.success("Registration successful!");
        handleNext(3, candName);
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
    setErrors((prev) => ({ ...prev, [name]: "" }));

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
          next.center_id = lockedCenter ? lockedCenter.center_id : 0;
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

  const selectedCenterName = useMemo(() => {
    if (lockedCenter) return lockedCenter.center_name;
    return (
      center.find((item) => Number(item.center_id) === Number(formData.center_id))
        ?.center_name || ""
    );
  }, [center, formData.center_id, lockedCenter]);

  const selectedCourseName = useMemo(
    () =>
      course.find((item) => Number(item.course_id) === Number(formData.course_id))
        ?.course_full_name || "",
    [course, formData.course_id]
  );

  const activeStep = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  // On a dedicated center link there is nothing to choose, so the center step
  // just states which center the application is for.
  const centerStepIsLocked = activeStep.key === "center" && Boolean(lockedCenter);
  const stepTitle = centerStepIsLocked ? "Your DigiBizz center" : activeStep.title;
  const stepSubtitle = centerStepIsLocked
    ? "Your application is for the center shown below."
    : activeStep.subtitle;

  const renderStepBody = () => {
    switch (activeStep.key) {
      case "personal":
        return (
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
        );
      case "contact":
        return (
          <ContactInformation
            formData={formData}
            errors={errors}
            handleInputChange={handleInputChange}
            emailVerified={emailVerified}
            onEmailVerifiedChange={setEmailVerified}
          />
        );
      case "academic":
        return (
          <AcademicInformation
            formData={formData}
            errors={errors}
            handleInputChange={handleInputChange}
          />
        );
      case "center":
        return (
          <DigiBizzCenterSelection
            formData={formData}
            errors={errors}
            handleInputChange={handleInputChange}
            center={center}
            isIttiRegistration={isIttiRegistration}
            admissionRules={admissionRules}
            lockedCenter={lockedCenter}
          />
        );
      case "course":
        return (
          <CourseTrackSelection
            formData={formData}
            errors={errors}
            handleInputChange={handleInputChange}
            course={course}
            admissionRules={admissionRules}
          />
        );
      case "agreement":
        return (
          <AgreementPolicy
            errors={errors}
            agreeToTerms={agreeToTerms}
            onAgreeChange={(checked) => {
              setAgreeToTerms(checked);
              setErrors((prev) => ({ ...prev, agreeToTerms: "" }));
            }}
          />
        );
      default:
        return null;
    }
  };

  const summaryRows = [
    { label: "Applicant", value: formData.cand_name || "—" },
    { label: "CNIC", value: cnicNo },
    { label: "District", value: formData.cand_local_domicile || "—" },
    { label: "Center", value: selectedCenterName || "Not chosen yet" },
    { label: "Preferred track", value: selectedCourseName || "Not chosen yet" },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="mx-auto max-w-6xl bg-white shadow-sm">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 sm:px-8">
          <img src={logo} alt="DigiBizz Balochistan" className="h-10 sm:h-12" />
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Save size={16} />
            <span>{savedAt ? `Draft saved ${savedAgo(savedAt)}` : "Draft saves automatically"}</span>
          </div>
        </header>

        {/* Stepper */}
        <nav className="flex overflow-x-auto border-b border-gray-200" aria-label="Progress">
          {STEPS.map((step, index) => {
            const isActive = index === stepIndex;
            const isDone = index < stepIndex;
            const isReachable = index <= maxStepReached;

            return (
              <button
                key={step.key}
                type="button"
                disabled={!isReachable}
                onClick={() => isReachable && goToStep(index)}
                className={`min-w-[150px] flex-1 border-r border-gray-200 px-4 py-3.5 text-left transition-colors last:border-r-0 ${
                  isActive
                    ? "border-t-[3px] border-t-[#006537] bg-white"
                    : isDone
                    ? "bg-[#006537]/5 hover:bg-[#006537]/10"
                    : "bg-gray-50"
                } ${isReachable ? "cursor-pointer" : "cursor-not-allowed"}`}
                aria-current={isActive ? "step" : undefined}
              >
                <span
                  className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${
                    isActive || isDone ? "text-[#006537]" : "text-gray-400"
                  }`}
                >
                  {isDone && <Check size={12} />}
                  Step {index + 1}
                </span>
                <span
                  className={`mt-0.5 block text-sm ${
                    isActive
                      ? "font-bold text-gray-900"
                      : isDone
                      ? "font-medium text-[#006537]"
                      : "text-gray-400"
                  }`}
                >
                  {step.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Body */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]">
          <form onSubmit={handleSubmit} noValidate className="px-5 py-7 sm:px-8">
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{stepTitle}</h1>
            <p className="mt-2 text-sm text-gray-500">{stepSubtitle}</p>

            <div className="mt-7">{renderStepBody()}</div>

            <div className="mt-9 flex items-center justify-between gap-3 border-t border-gray-200 pt-6">
              <button
                type="button"
                onClick={handleBack}
                disabled={stepIndex === 0}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft size={16} />
                Back
              </button>

              <button
                type={isLastStep ? "submit" : "button"}
                onClick={isLastStep ? undefined : handleContinue}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-md bg-[#006537] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#00522c] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Submitting..." : activeStep.nextLabel}
                {!isSubmitting && <ArrowRight size={16} />}
              </button>
            </div>
          </form>

          {/* Summary sidebar */}
          <aside className="border-t border-gray-200 bg-gray-50 px-5 py-7 sm:px-8 lg:border-l lg:border-t-0">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Your application
            </h2>

            <dl className="mt-4">
              {summaryRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-start justify-between gap-4 border-b border-gray-200 py-3 last:border-b-0"
                >
                  <dt className="text-sm text-gray-500">{row.label}</dt>
                  <dd className="text-right text-sm font-semibold text-gray-900">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>

            {batchName && (
              <p className="mt-4 text-xs text-gray-500">
                Applying for <span className="font-semibold text-gray-700">{batchName}</span>
              </p>
            )}

            <div className="mt-6 border-l-[3px] border-orange-400 bg-orange-50/60 px-4 py-3.5 text-sm text-gray-700">
              All communication about your application is sent by email, so make sure the
              address you enter is correct — and check your spam folder just in case.
            </div>

            <p className="mt-6 text-xs text-gray-500">
              Need help? Email{" "}
              <a
                href="mailto:support@digibizz.gob.pk"
                className="font-medium text-[#006537] underline"
              >
                support@digibizz.gob.pk
              </a>
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default RegistrationDetails;
