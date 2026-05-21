import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";
import {
  User,
  Laptop,
  ThumbsUp,
  School,
  CalendarDays,
  Info,
  BookOpen,
  Award,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import {
  getCandidateProfileByCnic,
  updateCandidateInterviewData,
  suspendCandidate,
  getAllCourse,
  getCenter,
} from "../../services/api";
import { Course } from "../../types/trainer";

interface FormData {
  cand_interview_marks: string;
  basicSkills: string;
  personality: string;
  freelancing: string;
  courseDomain: string;
  hasLaptop: boolean;
  isRecommended: boolean;
  courseTrack: string;
  centerPriority: string;
  interview_date: string;
  cand_admission_status: number;
  course_second_priority: number;
  center_second_priority: number;
  recommended: string;
  laptop_pc: string;
}

interface StudentInfo {
  name: string;
  cnic: string;
  gender: string;
  dob: string;
  email: string;
  currentCity: string;
  address: string;
  father: string;
  domicile: string;
  permanentCity: string;
  photo: string;
}

interface AdmissionInfo {
  course: string;
  courseName: string;
  center: string;
  centerName: string;
  testMarks: string;
}

interface AcademicInfo {
  degreeLevel: string;
  institute: string;
  startDate: string;
  endDate: string;
  degreeArea: string;
}

const initialStudentInfo: StudentInfo = {
  name: "",
  cnic: "",
  gender: "",
  dob: "",
  email: "",
  currentCity: "",
  address: "",
  father: "",
  domicile: "",
  permanentCity: "",
  photo: "",
};

const initialAdmissionInfo: AdmissionInfo = {
  course: "",
  courseName: "",
  center: "",
  centerName: "",
  testMarks: "",
};

const initialAcademicInfo: AcademicInfo = {
  degreeLevel: "",
  institute: "",
  startDate: "",
  endDate: "",
  degreeArea: "",
};

const InterviewPortal = () => {
  const [searchCnic, setSearchCnic] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [studentInfo, setStudentInfo] =
    useState<StudentInfo>(initialStudentInfo);
  const [admissionInfo, setAdmissionInfo] =
    useState<AdmissionInfo>(initialAdmissionInfo);
  const [course, setCourse] = useState<Course[]>([]);
  const [center, setCenter] = useState<
    { center_id: number; center_name: string }[]
  >([]);
  const [academicInfo, setAcademicInfo] =
    useState<AcademicInfo>(initialAcademicInfo);
  const [hasData, setHasData] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    cand_interview_marks: "",
    basicSkills: "",
    personality: "",
    freelancing: "",
    courseDomain: "",
    hasLaptop: true, // default to true (Yes)
    isRecommended: true, // default to true (Yes)
    courseTrack: "",
    centerPriority: "",
    interview_date: "",
    cand_admission_status: 0,
    course_second_priority: 0,
    center_second_priority: 0,
    recommended: "YES",
    laptop_pc: "YES",
  });
  const [rejectReason, setRejectReason] = useState("");
  const [candidateId, setCandidateId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuspending, setIsSuspending] = useState(false);
  const [candidateStatus, setCandidateStatus] = useState<number>(0); // 0: pending, 1: passed, 2: rejected/suspended
  const [hasInterviewMarks, setHasInterviewMarks] = useState(false);
  const [hideButtons, setHideButtons] = useState(false);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const formatCnic = (value: string) => {
    const cleanedValue = value.replace(/\D/g, "");
    const match = cleanedValue.match(/^(\d{0,5})(\d{0,7})(\d{0,1})$/);
    if (!match) return "";
    return [match[1], match[2], match[3]].filter(Boolean).join("-");
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    const formattedValue = formatCnic(value);
    setSearchCnic(formattedValue);
  };
  const fetchCenter = async () => {
    try {
      const data = await getCenter();
      setCenter(data);
    } catch (error) {
      console.error("Error fetching training batches:", error);
    }
  };
  const fetchCourse = async () => {
    try {
      const data = await getAllCourse();
      setCourse(data);
    } catch (error) {
      console.error("Error fetching training batches:", error);
    }
  };
  useEffect(() => {
    fetchCenter();
    fetchCourse();
    setRejectReason("");
    if (admissionInfo.course) {
      setAdmissionInfo((prev) => ({
        ...prev,
        courseName: admissionInfo.courseName || "",
        centerName: admissionInfo.centerName || "",
      }));
    }
  }, [admissionInfo.course, admissionInfo.center]);

  const handleSearch = async () => {
    if (!searchCnic) {
      toast.error("Please enter a CNIC number");
      return;
    }
    setRejectReason("");
    setIsSearching(true);
    setHasData(false);
    try {
      const response = await getCandidateProfileByCnic(searchCnic);

      if (response.success === false) {
        throw new Error("Student not found");
      }
      const data = response.candidate;

      setCandidateId(data.cand_id);

      // Update candidate status based on multiple conditions
      const status =
        (data.reject_reason ? 2 : data.recommended === "Yes" ? 1 : data.recommended === "No" ? 3 : 0);
      setCandidateStatus(status);

      const hasMarks = Boolean(
        data.cand_interview_marks &&
          data.cand_interview_marks !== "" &&
          data.cand_interview_marks !== "0"
      );
      setHasInterviewMarks(hasMarks);

      // Update form data with interview information
      setFormData({
        cand_interview_marks: data.cand_interview_marks || "",
        basicSkills: "",
        personality: "",
        freelancing: "",
        courseDomain: "",
        hasLaptop: data.laptop_pc === undefined || data.laptop_pc === null || data.laptop_pc === "" ? true : data.laptop_pc === "Yes",
        isRecommended: data.recommended === undefined || data.recommended === null || data.recommended === "" ? true : data.recommended === "Yes",
        courseTrack: data.course_second_priority?.toString() || "",
        centerPriority: data.center_second_priority?.toString() || "",
        interview_date: data.interview_date || "",
        cand_admission_status: status,
        course_second_priority: data.course_second_priority || 0,
        center_second_priority: data.center_second_priority || 0,
        recommended: data.recommended || "YES",
        laptop_pc: data.laptop_pc || "YES",
      });
      setAdmissionInfo({
        course: data.courses.course_name,
        courseName: data.courses.course_full_name,
        center: data.centers.center_name,
        centerName: data.centers.center_name,
        testMarks: data.cand_test_marks || "0",
      })
      // Update student info
      setStudentInfo({
        name: data.cand_name,
        cnic: data.cand_cnic,
        gender: data.cand_gender,
        dob: data.cand_dob,
        email: data.cand_email,
        currentCity: data.current_city,
        address: data.current_address,
        father: data.cand_fathername,
        domicile: data.cand_local_domicile,
        permanentCity: data.permanent_city,
        photo: data.cand_photo,
      });

      // Set reject reason if exists
      if (data.reject_reason) {
        setRejectReason(data.reject_reason);
      }

      // Update hide buttons based on interview date or rejection
      setHideButtons(
        Boolean(data.interview_date) || Boolean(data.reject_reason)
      );
      setHasData(true);
      toast.success("Student information retrieved successfully");
    } catch (error) {
      toast.error("Candidate not found");
      setStudentInfo(initialStudentInfo);
      setAdmissionInfo(initialAdmissionInfo);
      setAcademicInfo(initialAcademicInfo);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mandatory fields validation with specific error messages
    if (formData.basicSkills === "") {
      toast.error("Please enter Basic IT & English Skills score.");
      return;
    }
    if (formData.personality === "") {
      toast.error("Please enter Personality score.");
      return;
    }
    if (formData.freelancing === "") {
      toast.error("Please enter Freelancing score.");
      return;
    }
    if (formData.courseDomain === "") {
      toast.error("Please enter Course Domain score.");
      return;
    }

    if (!candidateId) {
      toast.error("Candidate ID is not available");
      return;
    }

    setIsSubmitting(true);

    try {
      const basicSkillScore = parseFloat(formData.basicSkills) || 0;
      const personalityScore = parseFloat(formData.personality) || 0;
      const freelancingScore = parseFloat(formData.freelancing) || 0;
      const courseDomainScore = parseFloat(formData.courseDomain) || 0;
      const total =
        basicSkillScore +
        personalityScore +
        freelancingScore +
        courseDomainScore;
      const updatedFormData = {
        ...formData,
        interview_date: new Date().toISOString().split("T")[0],
        cand_admission_status: 1,
        cand_interview_marks: total.toString(),
        laptop_pc: formData.hasLaptop ? "Yes" : "No",
        recommended: formData.isRecommended ? "Yes" : "No",
      };
      const response = await updateCandidateInterviewData(
        candidateId,
        updatedFormData
      );

      if (response.success) {
        toast.success("Interview data has been submitted successfully");
        setHideButtons(true);
        const status =
        ( formData.isRecommended === true ? 1 : formData.isRecommended === false ? 3 : 0);
        setCandidateStatus(status);
      } else {
        throw new Error(response.message || "Failed to update candidate");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to submit interview data"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!candidateId) {
      toast.error("Candidate ID is not available");
      return;
    }

    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setIsSuspending(true);

    try {
      setFormData((prev) => ({
        ...prev,
        cand_admission_status: 2,
        interview_date: new Date().toISOString().split("T")[0],
        laptop_pc: formData.hasLaptop ? "Yes" : "No",
        recommended: formData.isRecommended ? "Yes" : "No",
      }));

      const response = await suspendCandidate(candidateId, rejectReason);

      if (response.success) {
        toast.success("Candidate has been suspended successfully");
        setHideButtons(true);
        setCandidateStatus(2);
      } else {
        throw new Error(response.message || "Failed to suspend candidate");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to suspend candidate"
      );
    } finally {
      setIsSuspending(false);
    }
  };

  const isRejectButtonDisabled =
    isSuspending || hideButtons || candidateStatus === 1;

  const updateFormData = (field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleScoreChange = (field: keyof FormData, value: string) => {
    // Only allow numbers between 0 and their respective max
    let num = parseInt(value, 10);
    if (isNaN(num) || value === "") {
      updateFormData(field, "");
      return;
    }
    let max = 10;
    if (field === "basicSkills" || field === "personality") max = 5;
    if (num < 0) num = 0;
    if (num > max) num = max;
    updateFormData(field, num.toString());
  };

  useEffect(() => {
    const basicSkillScore = parseFloat(formData.basicSkills) || 0;
    const personalityScore = parseFloat(formData.personality) || 0;
    const freelancingScore = parseFloat(formData.freelancing) || 0;
    const courseDomainScore = parseFloat(formData.courseDomain) || 0;

    const total =
      basicSkillScore + personalityScore + freelancingScore + courseDomainScore;
    setFormData((prev) => ({
      ...prev,
      cand_interview_marks: total.toString(),
      laptop_pc: formData.hasLaptop ? "Yes" : "No",
      recommended: formData.isRecommended ? "Yes" : "No",
    }));
  }, [
    formData.basicSkills,
    formData.personality,
    formData.freelancing,
    formData.courseDomain,
  ]);

  const InfoSection = ({
    title,
    icon: Icon,
    children,
  }: {
    title: string;
    icon: any;
    children: React.ReactNode;
  }) => (
    <section className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))/0.5] transition-colors">
      <div className="bg-[hsl(var(--primary))] px-4 py-3 flex items-center gap-2">
        <span className="w-8 h-8 flex items-center justify-center bg-[hsl(var(--card))] rounded-full text-[hsl(var(--primary))]">
          <Icon className="w-5 h-5" />
        </span>
        <h2 className="text-[hsl(var(--primary-foreground))] font-medium">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );

  const InfoField = ({
    label,
    value,
    icon: Icon,
  }: {
    label: string;
    value: string;
    icon?: any;
  }) => (
    <div className="group">
      <span className="block text-sm text-[hsl(var(--muted-foreground))] flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4" />}
        {label}
      </span>
      <span className="font-medium text-[hsl(var(--foreground))] group-hover:text-[hsl(var(--primary))] transition-colors">
        {value}
      </span>
    </div>
  );

  const ScoreInput = ({
    label,
    value,
    onChange,
    max,
    disabled = false,
    forceDisabled = false, // new prop
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    max: number;
    disabled?: boolean;
    forceDisabled?: boolean;
  }) => (
    <div className="flex items-center gap-4 group p-2 -mx-2 rounded-lg hover:bg-[hsl(var(--muted))/0.5] transition-colors">
      <label className="block text-sm font-medium text-[hsl(var(--foreground))] flex-1 group-hover:text-[hsl(var(--primary))] transition-colors">
        {label}
      </label>
      <input
        type="text"
        min="0"
        max={max}
        value={value}
        onChange={(e) => {
          let val = e.target.value;
          // Allow multi-digit numbers, ignore non-numeric input
          if (!/^\d+$/.test(val)) {
            return;
          }
          onChange(val);
        }}
        onBlur={(e) => {
          let val = e.target.value;
          if (val === "") {
            onChange("");
            return;
          }
           if (!/^\d+$/.test(val)) {
            return;
          }
          let num = parseInt(val, 10);
          if (isNaN(num)) num = 0;
          if (num > max) num = max;
          if (num < 0) num = 0;
          onChange(num.toString());
        }}
        className={cn(
          "w-20 px-3 py-2 border border-[hsl(var(--border))] rounded-md focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] text-center bg-[hsl(var(--card))] text-[hsl(var(--foreground))]",
          (disabled || forceDisabled) && "bg-[hsl(var(--muted))] opacity-75 cursor-not-allowed"
        )}
        disabled={disabled || forceDisabled}
      />
      <span className="text-[hsl(var(--muted-foreground))] w-8">/ {max}</span>
    </div>
  );

  const RadioGroup = ({
    label,
    value,
    onChange,
    icon: Icon,
    disabled = false,
  }: {
    label: string;
    value: boolean | undefined;
    onChange: (value: boolean) => void;
    icon: any;
    disabled?: boolean;
  }) => {
    // Default to true (Yes) if value is undefined
    const checkedValue = value === undefined ? true : value;
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-[hsl(var(--foreground))] flex items-center gap-2">
          <Icon className="w-4 h-4" />
          {label}
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 p-2 -m-2 rounded-lg hover:bg-[hsl(var(--muted))/0.5] transition-colors cursor-pointer">
            <input
              type="radio"
              checked={checkedValue === true}
              onChange={() => onChange(true)}
              className="w-4 h-4 text-[hsl(var(--primary))]"
              disabled={hideButtons}
            />
            <span
              className={cn(
                hideButtons && "opacity-75",
                "text-[hsl(var(--foreground))]"
              )}
            >
              Yes
            </span>
          </label>
          <label className="flex items-center gap-2 p-2 -m-2 rounded-lg hover:bg-[hsl(var(--muted))/0.5] transition-colors cursor-pointer">
            <input
              type="radio"
              checked={checkedValue === false}
              onChange={() => onChange(false)}
              className="w-4 h-4 text-[hsl(var(--primary))]"
              disabled={hideButtons}
            />
            <span
              className={cn(
                hideButtons && "opacity-75",
                "text-[hsl(var(--foreground))]"
              )}
            >
              No
            </span>
          </label>
        </div>
      </div>
    );
  };

  const StatusBadge = () => {
    if (candidateStatus === 2) {
      return (
        <div className="mt-2 bg-red-300 text-gray-100 px-3 py-1 rounded-full text-sm inline-flex items-center">
          <Info className="w-4 h-4 mr-1" />
          {rejectReason ? "Rejected" : "Suspended"}
        </div>
      );
    } else if (candidateStatus === 1) {
      return (
        <div className="mt-2 bg-green-300 text-gray-100 px-3 py-1 rounded-full text-sm inline-flex items-center">
          <ThumbsUp className="w-4 h-4 mr-1" /> Recommended
        </div>
      );
    }
    else if (candidateStatus === 3) {
      return (
        <div className="mt-2 bg-red-300 text-gray-100 px-3 py-1 rounded-full text-sm inline-flex items-center">
          <Info className="w-4 h-4 mr-1" />
          Not Recommended
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] p-4 sm:p-6 lg:p-8 animate-fadeIn">
      <div className="max-w-6xl mx-auto bg-[hsl(var(--card))] rounded-lg shadow-sm overflow-hidden">
        <div className="p-6 border-b border-[hsl(var(--border))]">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <label
                htmlFor="searchCnic"
                className="block text-sm font-medium text-[hsl(var(--foreground))] mb-1"
              >
                Search by CNIC
              </label>
              <input
                id="searchCnic"
                type="text"
                value={searchCnic}
                onChange={handleChange}
                placeholder="Enter CNIC (e.g., 35202-1234567-1)"
                className="w-full px-4 py-2 border border-[hsl(var(--border))] rounded-md focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))]"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={isSearching}
              className="mt-6"
            >
              {isSearching ? (
                "Searching..."
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>
        </div>

        {hasData ? (
          <>
            <div className="text-center py-8 bg-[hsl(var(--muted))] border-b border-[hsl(var(--border))] relative">
              <span className="absolute left-4 top-4">
                <Info className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
              </span>
              <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
                Batch-8 Admissions
              </h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                Review and score candidate information
              </p>
              <StatusBadge />
            </div>

            <InfoSection title="General Information" icon={User}>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                <img
                  src={`${BACKEND_URL}${studentInfo.photo}`}
                  alt="Student"
                  className="absolute right-6 top-6 w-32 h-40 object-cover rounded-md shadow-sm"
                />

                <div className="space-y-4">
                  <InfoField label="Name" value={studentInfo.name} />
                  <InfoField label="Gender" value={studentInfo.gender} />
                  <InfoField label="Email" value={studentInfo.email} />
                  <InfoField
                    label="Current Address"
                    value={studentInfo.address}
                  />
                </div>

                <div className="space-y-4">
                  <InfoField label="CNIC" value={studentInfo.cnic} />
                  <InfoField label="Date of Birth" value={studentInfo.dob} />
                  <InfoField
                    label="Current City"
                    value={studentInfo.currentCity}
                  />
                </div>
              </div>
            </InfoSection>

            <InfoSection title="Admission Information" icon={BookOpen}>
              <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="px-4 py-3 bg-[hsl(var(--accent))/0.1] rounded-lg border border-[hsl(var(--accent))/0.2] hover:bg-[hsl(var(--accent))/0.15] transition-colors">
                  <span className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">
                    Course
                  </span>
                  <span className="font-medium text-[hsl(var(--foreground))]">
                    {admissionInfo.courseName}
                  </span>
                </div>
                <div className="px-4 py-3 bg-[hsl(var(--navy))/0.1] rounded-lg border border-[hsl(var(--navy))/0.2] hover:bg-[hsl(var(--navy))/0.15] transition-colors">
                  <span className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">
                    Center
                  </span>
                  <span className="font-medium text-[hsl(var(--foreground))]">
                    {admissionInfo.centerName}
                  </span>
                </div>
                {/* <div className="px-4 py-3 bg-[hsl(var(--teal))/0.1] rounded-lg border border-[hsl(var(--teal))/0.2] hover:bg-[hsl(var(--teal))/0.15] transition-colors">
                  <span className="block text-sm text-[hsl(var(--muted-foreground))] mb-1">
                    Test Marks
                  </span>
                  <span className="font-medium text-[hsl(var(--foreground))]">
                    {admissionInfo.testMarks}
                  </span>
                </div> */}
              </div>
            </InfoSection>

            <InfoSection title="Academic Information" icon={School}>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <InfoField
                    label="Degree Level"
                    value={academicInfo.degreeLevel}
                  />
                  <InfoField
                    label="Start Date"
                    value={academicInfo.startDate}
                  />
                  <InfoField label="End Date" value={academicInfo.endDate} />
                  <InfoField
                    label="Degree Area"
                    value={academicInfo.degreeArea}
                  />
                </div>
                <div className="space-y-4">
                  <InfoField label="Institute" value={academicInfo.institute} />
                </div>
              </div>
            </InfoSection>

            <form onSubmit={handleSubmit} className="p-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                    <Award className="w-5 h-5 text-[hsl(var(--primary))]" />
                    Interview Score
                  </h3>
                  <div className="space-y-4">
                    <ScoreInput
                      label="Total Interview Marks"
                      value={formData.cand_interview_marks}
                      onChange={(value) =>
                        updateFormData("cand_interview_marks", value)
                      }
                      max={30}
                      forceDisabled={true} // always disabled
                    />
                    <div className="space-y-4">
                      {/* Remove ScoreInput components and use normal label/input */}
                      <div className="flex items-center gap-4 group p-2 -mx-2 rounded-lg hover:bg-[hsl(var(--muted))/0.5] transition-colors">
                        <label className="block text-sm font-medium text-[hsl(var(--foreground))] flex-1 group-hover:text-[hsl(var(--primary))] transition-colors">
                          Basic IT & English Skills
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={5}
                          value={formData.basicSkills}
                          onChange={e => handleScoreChange("basicSkills", e.target.value)}
                          disabled={hideButtons}
                          required
                          className={cn(
                            "w-20 px-3 py-2 border border-[hsl(var(--border))] rounded-md focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] text-center bg-[hsl(var(--card))] text-[hsl(var(--foreground))]",
                        )} />
                        <span className="ml-2 text-[hsl(var(--muted-foreground))]">/ 5</span>
                      </div>
                      <div className="flex items-center gap-4 group p-2 -mx-2 rounded-lg hover:bg-[hsl(var(--muted))/0.5] transition-colors">
                        <label className="block text-sm font-medium text-[hsl(var(--foreground))] flex-1 group-hover:text-[hsl(var(--primary))] transition-colors">
                          Personality
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={5}
                          value={formData.personality}
                          onChange={e => handleScoreChange("personality", e.target.value)}
                          disabled={hideButtons}
                          required
                          className={cn(
                            "w-20 px-3 py-2 border border-[hsl(var(--border))] rounded-md focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] text-center bg-[hsl(var(--card))] text-[hsl(var(--foreground))]",
                        )} />
                        <span className="ml-2 text-[hsl(var(--muted-foreground))]">/ 5</span>
                      </div>
                      <div className="flex items-center gap-4 group p-2 -mx-2 rounded-lg hover:bg-[hsl(var(--muted))/0.5] transition-colors">
                        <label className="block text-sm font-medium text-[hsl(var(--foreground))] flex-1 group-hover:text-[hsl(var(--primary))] transition-colors">
                          Freelancing
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={formData.freelancing}
                          onChange={e => handleScoreChange("freelancing", e.target.value)}
                          disabled={hideButtons}
                          required
                          className={cn(
                            "w-20 px-3 py-2 border border-[hsl(var(--border))] rounded-md focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] text-center bg-[hsl(var(--card))] text-[hsl(var(--foreground))]",
                        )} />
                        <span className="ml-2 text-[hsl(var(--muted-foreground))]">/ 10</span>
                      </div>
                      <div className="flex items-center gap-4 group p-2 -mx-2 rounded-lg hover:bg-[hsl(var(--muted))/0.5] transition-colors">
                        <label className="block text-sm font-medium text-[hsl(var(--foreground))] flex-1 group-hover:text-[hsl(var(--primary))] transition-colors">
                          Course Domain
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          value={formData.courseDomain}
                          onChange={e => handleScoreChange("courseDomain", e.target.value)}
                          disabled={hideButtons}
                          required
                          className={cn(
                            "w-20 px-3 py-2 border border-[hsl(var(--border))] rounded-md focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] text-center bg-[hsl(var(--card))] text-[hsl(var(--foreground))]",
                        )}
        />
                        <span className="ml-2 text-[hsl(var(--muted-foreground))]">/ 10</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="p-6 bg-[hsl(var(--destructive))/0.1] rounded-lg border border-[hsl(var(--destructive))/0.2]">
                    <h4 className="font-medium text-[hsl(var(--destructive))] mb-2 flex items-center gap-2">
                      <Info className="w-5 h-5" />
                      Attention
                    </h4>
                    <p className="text-sm text-[hsl(var(--destructive))]">
                      If you found, this candidate has submitted any kind of
                      incorrect information, you can Reject the application by
                      writing the reason below:
                    </p>
                    <textarea
                      className="mt-3 w-full h-32 px-3 py-2 border border-[hsl(var(--border))] rounded-md focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] resize-none bg-[hsl(var(--card))] text-[hsl(var(--foreground))]"
                      placeholder="Please describe reason"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      disabled={isRejectButtonDisabled}
                    />
                    {!hideButtons && (
                      <button
                        type="button"
                        className={cn(
                          "mt-3 w-full px-4 py-2 bg-[hsl(var(--navy))] text-[hsl(var(--navy-foreground))] rounded-md hover:bg-[hsl(var(--navy))/0.9] transition-colors flex items-center justify-center gap-2",
                          isRejectButtonDisabled &&
                            "opacity-50 cursor-not-allowed"
                        )}
                        disabled={isRejectButtonDisabled}
                        onClick={handleReject}
                      >
                        {isSuspending
                          ? "Processing..."
                          : "Reject this Application"}
                      </button>
                    )}
                    {hasInterviewMarks && (
                      <div className="mt-3 p-2 bg-[hsl(var(--accent))/0.1] text-[hsl(var(--accent))] rounded-md text-center">
                        Interview marks have already been submitted
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <RadioGroup
                  label="Trainee have Laptop/Personal PC?"
                  value={formData.hasLaptop}
                  onChange={(value) => updateFormData("hasLaptop", value)}
                  icon={Laptop}
                  disabled={hideButtons}
                />
                <RadioGroup
                  label="Do you Recommended this Trainee?"
                  value={formData.isRecommended}
                  onChange={(value) => updateFormData("isRecommended", value)}
                  icon={ThumbsUp}
                  disabled={hideButtons}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[hsl(var(--foreground))] flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Course Track (2nd Priority)
                  </label>
                  <select
                    className={cn(
                      "w-full px-3 py-2 border border-[hsl(var(--border))] rounded-md focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))]",
                      hideButtons &&
                        "bg-[hsl(var(--muted))] opacity-75 cursor-not-allowed"
                    )}
                    value={formData.courseTrack}
                    onChange={(e) =>
                      updateFormData("courseTrack", e.target.value)
                    }
                    disabled={hideButtons}
                  >
                    <option value="">Please Select</option>
                    {course.map((courseItem) => (
                      <option
                        key={courseItem.course_id}
                        value={courseItem.course_id}
                      >
                        {courseItem.course_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[hsl(var(--foreground))] flex items-center gap-2">
                    <School className="w-4 h-4" />
                    Center (2nd Priority)
                  </label>
                  <select
                    className={cn(
                      "w-full px-3 py-2 border border-[hsl(var(--border))] rounded-md focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))]",
                      hideButtons &&
                        "bg-[hsl(var(--muted))] opacity-75 cursor-not-allowed"
                    )}
                    value={formData.centerPriority}
                    onChange={(e) =>
                      updateFormData("centerPriority", e.target.value)
                    }
                    disabled={hideButtons}
                  >
                    <option value="">Please Select</option>
                    {center.map((centerItem) => (
                      <option
                        key={centerItem.center_id}
                        value={centerItem.center_id}
                      >
                        {centerItem.center_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {!hideButtons ? (
                <button
                  type="submit"
                  disabled={hideButtons}
                  className={cn(
                    "w-full px-6 py-3 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-md font-medium transition-all",
                    "hover:bg-[hsl(var(--primary))/0.9] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:ring-offset-2",
                    "flex items-center justify-center gap-2",
                    hideButtons && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {isSubmitting ? <>Submitting...</> : <>Submit Form</>}
                </button>
              ) : (
                <div className="w-full p-4 bg-[hsl(var(--navy))/0.1] border border-[hsl(var(--navy))/0.2] rounded-md text-center text-[hsl(var(--navy))]">
                  This candidate's interview has already been processed.   <span className="text-bold">interview Status: <StatusBadge /></span>
                </div>
              )}
            </form>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default InterviewPortal;
