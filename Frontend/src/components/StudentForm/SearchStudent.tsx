import { useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  FileText,
  User2,
  Search,
  Printer,
  Edit,
  LogIn,
  MessageSquare,
  ExternalLink,
  Loader2,
  LockKeyhole,
  Trash2,
} from "lucide-react";
import { useBatch } from "../../context/BatchContext";
import {
  getStudentsByCNICProfile,
  getStudentsByEmailProfile,
  updateStudentDocuments,
  updateFreelancerProfiles,
  loginAsSubUser,
  resetStudentPasswordByAdmin,
} from "../../services/api";
import { toast } from "sonner";
import Loader from "../Loader";
import StudentForm from "./StudentForm";
import StudentSendMail from "./StudentSendMail";
import DeleteStudentDialog from "./DeleteStudentDialog";
import { isRole, ROLE } from "../../utils/roles";

interface AssignmentProgress {
  total: number;
  completed: number;
  missed: number;
  pending: number;
  completionRate: number;
}

interface Assignment {
  as_id: number;
  as_title: string;
  as_deadline?: string;
  as_marks?: number;
  as_added_on?: string;
  submitted_on?: string;
  obt_marks?: string;
  as_submission_status?: number;
}

interface Document {
  doc_id: number;
  std_cnic: string;
  doc_type: string;
  doc_file: string;
  doc_status: number;
  tb_id: number;
  doc_date: string;
}

interface ProfessionalProfile {
  sfp_id: number;
  std_cnic: string;
  ep_name: string;
  sfp_link: string;
  sfp_status: number;
  sfp_date: string;
}

interface StudentData {
  user_id: number;
  user_name: string;
  user_username: string;
  user_email: string;
  user_type: string;
  user_status: number;
  user_profile_photo: string;
  std_id: number;
  course_id: number;
  course_name: string;
  course_full_name: string;
  course_status: number;
  std_added_on: string;
  center_name: string;
  std_cnic: string;
  center_id: number;
  tb_id: number;
  std_gender: string;
  std_qualification: string;
  std_district: string;
  std_phone: string;
  std_fathername: string;
  std_lms_status: number;
  std_forum_status: number;
  std_rollno: string;
  attendanceProgress?: number;
  assignments?: {
    received: Assignment[];
    completed: Assignment[];
    missed: Assignment[];
    progress: AssignmentProgress;
  };
  tickets: {
    count: number;
  };
  feedback: {
    submissionCount: number;
  };
  documents: Document[];
  professionalProfiles: ProfessionalProfile[];
}

const SearchStudent = () => {
  const [searchMode, setSearchMode] = useState<"cnic" | "email">("cnic");
  const [searchCNIC, setSearchCNIC] = useState("");
  const [searchEmail, setSearchEmail] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const { selectedBatchId, userType } = useBatch();
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const [cnic, setCnic] = useState({
    cnicNo: "",
    confirmCnicNo: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isDocumentUpdating, setIsDocumentUpdating] = useState<number | null>(
    null
  );
  const [isProfileUpdating, setIsProfileUpdating] = useState<number | null>(
    null
  );
  const [isEditMode, setIsEditMode] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [showSendMail, setShowSendMail] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [passwordResetData, setPasswordResetData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [isPasswordResetting, setIsPasswordResetting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Same rule as the enrolled-student table: permanent deletion is SuperAdmin
  // only, and the server enforces it independently of this flag.
  const canDeleteStudents = isRole(userType, ROLE.SUPER_ADMIN);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    if (searchMode === "cnic") {
      setSearchCNIC(formatCnic(value));
      return;
    }
    setSearchEmail(value);
  };

  const formatCnic = (value: string) => {
    const cleanedValue = value.replace(/\D/g, "");
    const match = cleanedValue.match(/^(\d{0,5})(\d{0,7})(\d{0,1})$/);
    if (!match) return "";
    return [match[1], match[2], match[3]].filter(Boolean).join("-");
  };

  const handleSearch = async () => {
    setIsLoading(true);
    try {
      const query = searchMode === "cnic" ? searchCNIC.trim() : searchEmail.trim();

      if (!query) {
        toast.error(
          searchMode === "cnic"
            ? "Please enter a student CNIC"
            : "Please enter a student email"
        );
        return;
      }

      const response =
        searchMode === "cnic"
          ? await getStudentsByCNICProfile(query)
          : await getStudentsByEmailProfile(query);
      if (response.success) {
        setStudentData(response.data);
        setShowProfile(true);
      }
    } catch (error) {
      console.error("Error:", error);
      setStudentData(null);
      setShowProfile(false);
      toast.error(
        error instanceof Error ? error.message : "Failed to fetch student data"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDocumentAction = async (
    docId: number,
    action: "approve" | "reject"
  ) => {
    setIsDocumentUpdating(docId);
    try {
      let status = action === "approve" ? 1 : 2;
      const response = await updateStudentDocuments(docId, status);
      if (response.success) {
        toast.success(`Document ${action}d successfully!`);
        handleSearch();
      }
    } catch (error) {
      console.error(`Error ${action}ing document:`, error);
      toast.error(`Failed to ${action} document`);
    } finally {
      setIsDocumentUpdating(null);
    }
  };

  const handleProfileAction = async (
    profileId: number,
    action: "approve" | "reject"
  ) => {
    setIsProfileUpdating(profileId);
    try {
      let status = action === "approve" ? 1 : 2;
      const response = await updateFreelancerProfiles(profileId, status);
      if (response.success) {
        toast.success(`Profile ${action}d successfully!`);
        handleSearch();
      }
    } catch (error) {
      console.error(`Error ${action}ing profile:`, error);
      toast.error(`Failed to ${action} profile`);
    } finally {
      setIsProfileUpdating(null);
    }
  };

  const handleEdit = () => {
    if (!studentData) return;
    setEditData({
      std_rollno: studentData.std_rollno,
      std_cnic: studentData.std_cnic,
      user_name: studentData.user_name,
      user_username: studentData.user_username,
      std_fathername: studentData.std_fathername,
      std_gender: studentData.std_gender,
      std_qualification: studentData.std_qualification,
      std_district: studentData.std_district,
      user_email: studentData.user_email,
      std_phone: studentData.std_phone,
      user_password: "",
      confirm_password: "",
      user_type: studentData.user_type,
      user_status: studentData.user_status,
      course_id: studentData.course_id,
      center_id: studentData.center_id,
      t_id: 0,
      tb_id: selectedBatchId,
      dark_mode: "0",
      special_case: 0,
      special_case_comments: "",
    });
    setIsEditMode(true);
  };

  const handleFormClose = () => {
    setIsEditMode(false);
    setEditData(null);
    handleSearch();
  };

  // Format date helper function
  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };
  const handleLogin = async () => {
    if (!studentData) return;

    try {
      const login = await loginAsSubUser(studentData.user_id);
      if (login.success) {
        const timestamp = new Date().getTime();
        const loginUrl = `/dashboard?subuser=${studentData.user_id}&t=${timestamp}`;
        window.open(loginUrl, "_blank");
      } else {
        console.error("Login failed");
      }
    } catch (error) {
      console.error("Error during login:", error);
    }
  };

  const handleResetPassword = async () => {
    if (!studentData) return;

    if (passwordResetData.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (passwordResetData.newPassword !== passwordResetData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsPasswordResetting(true);
    try {
      const response = await resetStudentPasswordByAdmin(
        studentData.user_id,
        passwordResetData.newPassword
      );

      if (response.success) {
        toast.success("Student password reset successfully");
        setPasswordResetData({ newPassword: "", confirmPassword: "" });
        setShowPasswordReset(false);
        void handleSearch();
      } else {
        toast.error(response.message || "Failed to reset password");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reset password"
      );
    } finally {
      setIsPasswordResetting(false);
    }
  };

  const handleDeleted = () => {
    setShowDeleteDialog(false);
    setShowProfile(false);
    setStudentData(null);
    setSearchCNIC("");
    setSearchEmail("");
  };

  const closePasswordReset = () => {
    setShowPasswordReset(false);
    setPasswordResetData({ newPassword: "", confirmPassword: "" });
  };
  // Get document status badge
  const getDocStatusBadge = (status: number) => {
    switch (status) {
      case 1:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">
            Verified
          </span>
        );
      case 2:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]">
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[hsl(var(--info))] text-[hsl(var(--info-foreground))]">
            Pending
          </span>
        );
    }
  };

  // Get professional profile status badge
  const getProfileStatusBadge = (status: number) => {
    switch (status) {
      case 1:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">
            Verified
          </span>
        );
      case 2:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]">
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]">
            Pending
          </span>
        );
    }
  };

  // Format document type for display
  const formatDocType = (docType: string) => {
    return docType
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] py-8 px-4 sm:px-6 lg:px-8 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">
            DigiBizz Student Profile
          </h1>

          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => setSearchMode("cnic")}
              className={`px-4 py-2 rounded-md border transition-colors ${
                searchMode === "cnic"
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border-[hsl(var(--primary))]"
                  : "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] border-[hsl(var(--border))]"
              }`}
            >
              Search By CNIC
            </button>
            <button
              type="button"
              onClick={() => setSearchMode("email")}
              className={`px-4 py-2 rounded-md border transition-colors ${
                searchMode === "email"
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border-[hsl(var(--primary))]"
                  : "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] border-[hsl(var(--border))]"
              }`}
            >
              Search By Email
            </button>
          </div>

          <div className="mt-4 flex justify-center gap-4">
            <input
              type="text"
              placeholder={
                searchMode === "cnic"
                  ? "Enter Student CNIC"
                  : "Enter Student Email"
              }
              value={searchMode === "cnic" ? searchCNIC : searchEmail}
              onChange={handleChange}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleSearch();
                }
              }}
              disabled={isLoading}
              className="px-4 py-2 border border-[hsl(var(--border))] rounded-md focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] w-full max-w-md text-[hsl(var(--foreground))] bg-[hsl(var(--card))]"
            />
            <button
              onClick={handleSearch}
              disabled={isLoading}
              className="px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-md hover:bg-[hsl(var(--accent))] transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isLoading ? <Loader /> : <Search className="w-4 h-4" />}
              {isLoading ? "Searching..." : "Search"}
            </button>
          </div>
        </header>

        {isEditMode && editData ? (
          <StudentForm initialData={editData} onClose={handleFormClose} />
        ) : showSendMail ? (
          <StudentSendMail
            email={studentData?.user_email || ""}
            onClose={() => setShowSendMail(false)}
          />
        ) : (
          showProfile && studentData && (
            <>
            {userType !== "trainer" &&(
              <div className="flex justify-end gap-4 mb-6">
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 bg-[hsl(var(--teal))] text-[hsl(var(--primary-foreground))] rounded-md hover:bg-[hsl(var(--accent))] transition-colors flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
                <button
                  onClick={handleEdit}
                  className="px-4 py-2 bg-[hsl(var(--teal))] text-[hsl(var(--primary-foreground))] rounded-md hover:bg-[hsl(var(--accent))] transition-colors flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                <button onClick={handleLogin} className="px-4 py-2 bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] rounded-md hover:bg-[hsl(var(--accent))] transition-colors flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  Login as Student
                </button>
                <button
                  className="px-4 py-2 bg-[hsl(var(--pink))] text-[hsl(var(--primary-foreground))] rounded-md hover:bg-[hsl(var(--accent))] transition-colors flex items-center gap-2"
                  onClick={() => setShowSendMail(true)}
                >
                  <MessageSquare className="w-4 h-4" />
                  Send Message
                </button>
                <button
                  className="px-4 py-2 bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] rounded-md hover:bg-[hsl(var(--accent))] transition-colors flex items-center gap-2"
                  onClick={() => setShowPasswordReset(true)}
                >
                  <LockKeyhole className="w-4 h-4" />
                  Reset Password
                </button>
                {canDeleteStudents && (
                  <button
                    className="px-4 py-2 bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] rounded-md hover:opacity-90 transition-colors flex items-center gap-2"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Student
                  </button>
                )}
              </div>
            )}
              {showPasswordReset && (
                <div className="mb-6 bg-[hsl(var(--card))] rounded-lg border border-[hsl(var(--border))] shadow-sm p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">
                        Reset Student Password
                      </h3>
                      <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                        Setting a new password for {studentData.user_name} (
                        {studentData.user_email}).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closePasswordReset}
                      className="text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={passwordResetData.newPassword}
                        onChange={(e) =>
                          setPasswordResetData((prev) => ({
                            ...prev,
                            newPassword: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-[hsl(var(--border))] rounded-md bg-[hsl(var(--card))] text-[hsl(var(--foreground))]"
                        placeholder="Enter new password"
                        disabled={isPasswordResetting}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[hsl(var(--foreground))] mb-2">
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        value={passwordResetData.confirmPassword}
                        onChange={(e) =>
                          setPasswordResetData((prev) => ({
                            ...prev,
                            confirmPassword: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-[hsl(var(--border))] rounded-md bg-[hsl(var(--card))] text-[hsl(var(--foreground))]"
                        placeholder="Confirm new password"
                        disabled={isPasswordResetting}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end mt-4">
                    <button
                      type="button"
                      onClick={handleResetPassword}
                      disabled={isPasswordResetting}
                      className="px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-md hover:bg-[hsl(var(--accent))] transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      {isPasswordResetting && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                      {isPasswordResetting ? "Resetting..." : "Save Password"}
                    </button>
                  </div>
                </div>
              )}
              <div className="header-gradient-student rounded-lg p-6 mb-8 flex items-center transform hover:scale-[1.02] transition-all duration-300 bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-fg))]">
                <div className="flex-shrink-0">
                  <img
                    src={`${BACKEND_URL}${studentData.user_profile_photo}`}
                    alt={studentData.user_name}
                    className="w-48 h-48 rounded-full border-4 border-[hsl(var(--card))] shadow-lg hover:border-[hsl(var(--primary))] transition-colors"
                  />
                </div>
                <div className="ml-6 flex-1">
                  <h2 className="text-2xl font-bold hover:text-[hsl(var(--primary))] transition-colors">
                    {studentData.user_name}
                  </h2>
                  <div className="flex gap-4 mt-2 text-[hsl(var(--accent))]">
                    <span>{studentData.std_cnic}</span>
                    <span className="text-[hsl(var(--muted))]">|</span>
                    <span>{studentData.std_rollno}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-[hsl(var(--card))] rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  <div className="bg-[hsl(var(--card))] px-6 py-4">
                    <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
                      <User2 className="w-5 h-5" />
                      General Information
                    </h3>
                  </div>
                  <div className="divide-y divide-[hsl(var(--border))]">
                    {[
                      ["Name", studentData.user_name],
                      ["Father Name", studentData.std_fathername],
                      ["Course", studentData.course_full_name],
                      ["Center", studentData.center_name],
                      ["Email", studentData.user_email],
                      ["Phone", studentData.std_phone],
                      ["Qualification", studentData.std_qualification || "N/A"],
                      ["District", studentData.std_district || "N/A"],
                      [
                        "Status",
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            studentData.user_status === 1
                              ? "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]"
                              : "bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]"
                          }`}
                        >
                          {studentData.user_status === 1 ? "Active" : "Inactive"}
                        </span>,
                      ],
                    ].map(([label, value], idx) => (
                      <div
                        key={idx}
                        className="px-6 py-4 flex justify-between items-center hover:bg-[hsl(var(--hover))] transition-colors"
                      >
                        <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
                          {label}
                        </span>
                        <span className="text-sm text-[hsl(var(--foreground))]">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[hsl(var(--card))] rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  <div className="bg-[hsl(var(--primary))] px-6 py-4">
                    <h3 className="text-lg font-semibold text-[hsl(var(--primary-foreground))] flex items-center gap-2">
                      <BookOpen className="w-5 h-5" />
                      Progress & Activity
                    </h3>
                  </div>
                  <div className="p-6 space-y-6">
                    {[
                      [
                        "Received Assignments",
                        studentData.assignments?.received?.length?.toString() || "0",
                      ],
                      [
                        "Completed Assignments",
                        studentData.assignments?.completed?.length?.toString() || "0",
                      ],
                      [
                        "Missed Assignments",
                        studentData.assignments?.missed?.length?.toString() || "0",
                      ],
                    ].map(([label, value], idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center"
                      >
                        <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
                          {label}
                        </span>
                        <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
                          {value}
                        </span>
                      </div>
                    ))}

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
                          Assignment Progress
                        </span>
                        <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
                          {studentData.assignments?.progress?.completionRate || 0}%
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-bar-fill"
                          style={{
                            width: `${studentData.assignments?.progress?.completionRate || 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="pt-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
                          Tickets
                        </span>
                        <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
                          {studentData.tickets.count}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
                          Feedback Submitted
                        </span>
                        <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
                          {studentData.feedback.submissionCount}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 bg-[hsl(var(--card))] rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="bg-[hsl(var(--success))] px-6 py-4">
                  <h3 className="text-lg font-semibold text-[hsl(var(--success-foreground))] flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Documents
                  </h3>
                  <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                    Documents must be original scanned and clearly visible.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-[hsl(var(--border))]">
                    <thead className="bg-[hsl(var(--muted))]">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                          Document Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                          Last Update
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-[hsl(var(--card))] divide-y divide-[hsl(var(--border))]">
                      {studentData.documents.length > 0 ? (
                        studentData.documents.map((doc) => (
                          <tr
                            key={doc.doc_id}
                            className="hover:bg-[hsl(var(--hover))] transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[hsl(var(--foreground))]">
                              {formatDocType(doc.doc_type)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[hsl(var(--muted-foreground))]">
                              {formatDate(doc.doc_date)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {getDocStatusBadge(doc.doc_status)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2 flex items-center">
                              <a
                                href={`${BACKEND_URL}${doc.doc_file}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[hsl(var(--info))] hover:text-[hsl(var(--info-foreground))] flex items-center"
                              >
                                View <ExternalLink className="ml-1 w-3 h-3" />
                              </a>
                              {doc.doc_status === 0 ? (
                                <>
                                  <button
                                    onClick={() =>
                                      handleDocumentAction(doc.doc_id, "approve")
                                    }
                                    disabled={isDocumentUpdating === doc.doc_id}
                                    className="px-2 py-1 bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] rounded hover:bg-[hsl(var(--success-hover))] disabled:opacity-50 flex items-center gap-1"
                                  >
                                    {isDocumentUpdating === doc.doc_id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : null}
                                    Approve
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleDocumentAction(doc.doc_id, "reject")
                                    }
                                    className="px-2 py-1 bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] rounded hover:bg-[hsl(var(--warning-hover))] disabled:opacity-50 flex items-center gap-1"
                                  >
                                    {isDocumentUpdating === doc.doc_id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : null}
                                    Remove
                                  </button>
                                </>
                              ) : doc.doc_status === 1 ? (
                                <button
                                  onClick={() =>
                                    handleDocumentAction(doc.doc_id, "reject")
                                  }
                                  disabled={isDocumentUpdating === doc.doc_id}
                                  className="px-2 py-1 bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] rounded hover:bg-[hsl(var(--warning-hover))] disabled:opacity-50 flex items-center gap-1"
                                >
                                  {isDocumentUpdating === doc.doc_id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : null}
                                  Remove
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-6 py-4 whitespace-nowrap text-sm text-[hsl(var(--muted-foreground))] text-center"
                          >
                            No documents uploaded yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-8 bg-[hsl(var(--card))] rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="bg-[hsl(var(--destructive))] px-6 py-4">
                  <h3 className="text-lg font-semibold text-[hsl(var(--destructive-foreground))] flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    Professional Profiles
                  </h3>
                  <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                    NOTE: Fresh and Uptodate Profile links are necessary.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-[hsl(var(--border))]">
                    <thead className="bg-[hsl(var(--muted))]">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                          Platform
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                          Last Updated
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-[hsl(var(--card))] divide-y divide-[hsl(var(--border))]">
                      {studentData.professionalProfiles.length > 0 ? (
                        studentData.professionalProfiles.map((profile) => (
                          <tr
                            key={profile.sfp_id}
                            className="hover:bg-[hsl(var(--hover))] transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[hsl(var(--foreground))]">
                              {profile.ep_name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[hsl(var(--muted-foreground))]">
                              {formatDate(profile.sfp_date)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {getProfileStatusBadge(profile.sfp_status)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2 flex items-center">
                              <a
                                href={profile.sfp_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[hsl(var(--info))] hover:text-[hsl(var(--info-foreground))] flex items-center"
                              >
                                Visit <ExternalLink className="ml-1 w-3 h-3" />
                              </a>
                              {profile.sfp_status === 0 && (
                                <>
                                  <button
                                    onClick={() =>
                                      handleProfileAction(
                                        profile.sfp_id,
                                        "approve"
                                      )
                                    }
                                    disabled={
                                      isProfileUpdating === profile.sfp_id
                                    }
                                    className="px-2 py-1 bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] rounded hover:bg-[hsl(var(--success-hover))] disabled:opacity-50 flex items-center gap-1"
                                  >
                                    {isProfileUpdating === profile.sfp_id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : null}
                                    Approve
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleProfileAction(
                                        profile.sfp_id,
                                        "reject"
                                      )
                                    }
                                    disabled={
                                      isProfileUpdating === profile.sfp_id
                                    }
                                    className="px-2 py-1 bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] rounded hover:bg-[hsl(var(--destructive-hover))] disabled:opacity-50 flex items-center gap-1"
                                  >
                                    {isProfileUpdating === profile.sfp_id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : null}
                                    Reject
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-6 py-4 whitespace-nowrap text-sm text-[hsl(var(--muted-foreground))] text-center"
                          >
                            No professional profiles added yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )
        )}
      </div>

      <DeleteStudentDialog
        student={showDeleteDialog && studentData ? studentData : null}
        onClose={() => setShowDeleteDialog(false)}
        onDeleted={handleDeleted}
      />
    </div>
  );
};

export default SearchStudent;
