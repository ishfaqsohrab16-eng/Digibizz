import React, { useState, useEffect } from "react";
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
  ArrowLeft,
  Loader2,
} from "lucide-react";
import {
  getStudentsByCNICProfile,
  loginAsSubUser,
  updateFreelancerProfiles,
  updateStudentDocuments,
} from "../../services/api";
import { toast } from "sonner";
import StudentForm from "./StudentForm";
import StudentSendMail from "./StudentSendMail";
import { useBatch } from "../../context/BatchContext";

export interface AssignmentProgress {
  total: number;
  completed: number;
  missed: number;
  pending: number;
  completionRate: number;
}

export interface Assignment {
  as_id: number;
  as_title: string;
  as_deadline?: string;
  as_marks?: number;
  as_added_on?: string;
  submitted_on?: string;
  obt_marks?: string;
  as_submission_status?: number;
}

export interface Document {
  doc_id: number;
  std_cnic: string;
  doc_type: string;
  doc_file: string;
  doc_status: number;
  tb_id: number;
  doc_date: string;
}

export interface ProfessionalProfile {
  sfp_id: number;
  std_cnic: string;
  ep_name: string;
  sfp_link: string;
  sfp_status: number;
  sfp_date: string;
}

export interface StudentData {
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
  std_gender: string;
  std_qualification: string;
  std_district: string;
  std_phone: string;
  std_fathername: string;
  std_lms_status: number;
  std_forum_status: number;
  std_rollno: string;
  assignments?: {
    received: Assignment[];
    completed: Assignment[];
    missed: Assignment[];
    progress: AssignmentProgress;
  };
  tickets?: {
    count: number;
  };
  feedback?: {
    submissionCount: number;
  };
  documents?: Document[];
  professionalProfiles?: ProfessionalProfile[];
  earnings?: number;
}

interface StudentProfileProps {
  studentData?: StudentData | null;
  onClose?: () => void;
}

const StudentProfile: React.FC<StudentProfileProps> = ({
  studentData: initialData,
  onClose,
}) => {
  const [studentData, setStudentData] = useState<StudentData | null>(
    initialData || null
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [imageError, setImageError] = useState<boolean>(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [showSendMail, setShowSendMail] = useState(false);
  const { selectedBatchId, userType } = useBatch();

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  // Fallback image as base64 or simple SVG
  const defaultAvatarUrl =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'/%3E%3Ccircle cx='12' cy='7' r='4'/%3E%3C/svg%3E";

  const handlePrint = () => {
    window.print();
  };
  const [isDocumentUpdating, setIsDocumentUpdating] = useState<number | null>(
    null
  );
  const [isProfileUpdating, setIsProfileUpdating] = useState<number | null>(
    null
  );

  const refreshStudentData = async () => {
    if (!studentData?.std_cnic) return;
    try {
      const response = await getStudentsByCNICProfile(studentData.std_cnic);
      if (response.success) {
        setStudentData(response.data);
      }
    } catch (error) {
      console.error("Error refreshing student data:", error);
    }
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
        await refreshStudentData();
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
        await refreshStudentData();
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
    refreshStudentData();
  };

  // Format date helper function
  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Get document status badge
  const getDocStatusBadge = (status: number) => {
    switch (status) {
      case 1:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[hsl(var(--teal-light))] text-[hsl(var(--teal))]">
            Verified
          </span>
        );
      case 2:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[hsl(var(--pink-light))] text-[hsl(var(--pink))]">
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[hsl(var(--blue-light))] text-[hsl(var(--blue))]">
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
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[hsl(var(--teal-light))] text-[hsl(var(--teal))]">
            Verified
          </span>
        );
      case 2:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[hsl(var(--pink-light))] text-[hsl(var(--pink))]">
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[hsl(var(--yellow-light))] text-[hsl(var(--yellow))]">
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

  const getProfileImage = () => {
    if (!studentData?.user_profile_photo) return defaultAvatarUrl;
    if (imageError) return defaultAvatarUrl;
    return `${BACKEND_URL}${studentData.user_profile_photo}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[hsl(var(--primary))]"></div>
      </div>
    );
  }

  if (!studentData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-[hsl(var(--foreground))] mb-2">
            Student data not available
          </h2>
          <p className="text-[hsl(var(--muted-foreground))]">
            Unable to load student information
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="mt-6 px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-md hover:bg-[hsl(var(--primary))]/90 transition-colors flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Go Back
          </button>
        )}
      </div>
    );
  }

  if (isEditMode && editData) {
    return <StudentForm initialData={editData} onClose={handleFormClose} />;
  }

  if (showSendMail && studentData) {
    return (
      <StudentSendMail
        email={studentData.user_email}
        onClose={() => setShowSendMail(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] py-8 px-4 sm:px-6 lg:px-8 animate-fade-in">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] rounded-md hover:bg-[hsl(var(--muted-foreground))] transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to list
            </button>
          )}
        {userType !== "trainer" &&(
          <div className="flex gap-4">
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
            
            <button
              onClick={handleLogin}
              className="px-4 py-2 bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] rounded-md hover:bg-[hsl(var(--accent))] transition-colors flex items-center gap-2"
            >
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
          </div>
          )}
        </div>

        <div className="header-gradient-student rounded-lg p-6 mb-8 flex items-center transform hover:scale-[1.02] transition-all duration-300 bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-fg))]">
          <div className="flex-shrink-0">
            <img
              src={getProfileImage()}
              alt={studentData.user_name}
              className="w-48 h-48 rounded-full border-4 border-[hsl(var(--card))] shadow-lg hover:border-[hsl(var(--primary))] transition-colors"
              onError={() => setImageError(true)}
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
            <div className="bg-[hsl(var(--pink-light))] px-6 py-4">
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
                        ? "bg-[hsl(var(--teal-light))] text-[hsl(var(--teal))]"
                        : "bg-[hsl(var(--pink-light))] text-[hsl(var(--pink))]"
                    }`}
                  >
                    {studentData.user_status === 1 ? "Active" : "Inactive"}
                  </span>,
                ],
              ].map(([label, value], idx) => (
                <div
                  key={idx}
                  className="px-6 py-4 flex justify-between items-center hover:bg-[hsl(var(--muted))] transition-colors"
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
            <div className="bg-[hsl(var(--primary))]/10 px-6 py-4">
              <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Progress & Activity
              </h3>
            </div>
            <div className="p-6 space-y-6">
              {studentData.assignments &&
                [
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
                  <div key={idx} className="flex justify-between items-center">
                    <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
                      {label}
                    </span>
                    <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
                      {value}
                    </span>
                  </div>
                ))}

              {studentData.assignments && (
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
              )}

              <div className="pt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
                    Tickets
                  </span>
                  <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
                    {studentData.tickets ? studentData.tickets.count : 0}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
                    Feedback Submitted
                  </span>
                  <span className="text-sm font-semibold text-[hsl(var(--foreground))]">
                    {studentData.feedback
                      ? studentData.feedback.submissionCount
                      : 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-[hsl(var(--card))] rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
          <div className="bg-[hsl(var(--green-light))] px-6 py-4">
            <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
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
                       {studentData.documents && studentData.documents.length > 0 ? (
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
          <div className="bg-[hsl(var(--pink-light))] px-6 py-4">
            <h3 className="text-lg font-semibold text-[hsl(var(--foreground))] flex items-center gap-2">
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
                {studentData.professionalProfiles &&
                studentData.professionalProfiles.length > 0 ? (
                  studentData.professionalProfiles.map((profile) => (
                    <tr
                      key={profile.sfp_id}
                      className="hover:bg-[hsl(var(--muted))] transition-colors"
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[hsl(var(--muted-foreground))]">
                        <a
                          href={profile.sfp_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[hsl(var(--blue))] hover:text-[hsl(var(--blue))]/90 flex items-center"
                        >
                          Visit <ExternalLink className="ml-1 w-3 h-3" />
                          {profile.sfp_status === 0 && (
                            <>
                              <button
                                onClick={() =>
                                  handleProfileAction(profile.sfp_id, "approve")
                                }
                                disabled={isProfileUpdating === profile.sfp_id}
                                className="px-2 py-1 bg-[hsl(var(--teal))] text-[hsl(var(--primary-foreground))] rounded hover:bg-[hsl(var(--teal))]/90 disabled:opacity-50 flex items-center gap-1"
                              >
                                {isProfileUpdating === profile.sfp_id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : null}
                                Approve
                              </button>
                              <button
                                onClick={() =>
                                  handleProfileAction(profile.sfp_id, "reject")
                                }
                                disabled={isProfileUpdating === profile.sfp_id}
                                className="px-2 py-1 bg-[hsl(var(--pink))] text-[hsl(var(--primary-foreground))] rounded hover:bg-[hsl(var(--pink))]/90 disabled:opacity-50 flex items-center gap-1"
                              >
                                {isProfileUpdating === profile.sfp_id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : null}
                                Reject
                              </button>
                            </>
                          )}
                        </a>
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
      </div>
    </div>
  );
};

export default StudentProfile;
