import { Admin, LoginCredentials } from "../types/admin";
import axios, { AxiosError } from "axios";

import { addUserId } from "./userManager";
import { UploadImageFormData } from "../components/Settings/ProfilePhoto";
import { TrainingBatchFormData } from "../types/trainingBatchFormData";
import {
  TrainerCenterAllocationFormData,
  TrainerFormData,
} from "../types/trainer";
import {
  StudentAttendanceInput,
  StudentRegistrationData,
} from "../types/student";
import {
  CandidateFormData,
  UpdateCandidateTestScoreType,
} from "../types/registration";
import { AssignmentFormData } from "../types/assignment";
import { TrainerAttendanceInput } from "../types/trainerAttendance";
import { CenterUserFormData } from "../types/centerUser";
import { EarningFormData } from "../types/earningFormData";
import { StudentLeaveFormData, TrainersLeaveFormData } from "../types/leave";
import { StudentDocumentFormData } from "../components/StudentForm/StudentDocs";
import { FreelanceProfile } from "../components/StudentForm/FreelancingProfile";
import { FeedbackSubmission } from "../components/StudentForm/StudentFeedback";
import {
  Quiz,
  QuizAttemptFormData,
  QuizFormData,
  QuizSubmissionResponse,
} from "../types/quiz";
import { DailyReportFormData } from "../components/DailyLectureReport/DailyLectureReportForm";
import { TrainerDashboardData } from "../components/dashboards/TrainerDashboard";
import { AnnouncementFormData } from "../types/announcements";
import { TicketFormData, TicketReplyFormData } from "../types/ticket";
import { CourseFormData } from "../components/CourseForm";
import { HolidayFormProps } from "../components/Holidays/HolidayForm";
import { DashboardData } from "../components/dashboards/StudentDashboard";
import {
  LearningResourceData,
  LectureRecordingData,
} from "../types/learningResources";
import { QuizSubmission } from "../components/Quiz/QuizAttempt";
import { MasterTrainerDashboardData } from "../components/dashboards/MasterTrainerDashboard";
import { CourseModuleFormData } from "../types/courseModule";
import { storage } from "../utils/storage";

const API_URL = import.meta.env.VITE_BACKEND_URL + "/api";
// Interface definitions
interface AdminFormData {
  user_name: string;
  user_username: string;
  user_password: string;
  user_email: string;
  admin_type: string;
  admin_status?: number;
}
export interface MasterFromData {
  user_name: string;
  user_email: string;
  user_username: string;
  user_password: string;
  mt_course_id: number;
  mt_dark_mode: string;
  user_status: number;
}

export interface MasterResponse {
  message: string;
  token: string;
  masterTrainer: {
    id: number;
    user_name: string;
    user_email: string;
    user_password: string;
    profile_photo: File | null;
    mt_course_id: number;
    mt_dark_mode: string;
    user_status: number;
  };
}

interface TrainerResponse {
  success: any;
  message: string;
  token: string;
  trainer: {
    id: number;
    name: string;
    email: string;
    courseId: number;
  };
}
interface ValidationError {
  type: string;
  value?: string;
  msg: string;
  path: string;
  location: string;
}

export interface ApiError {
  errors: ValidationError[];
}
interface AdminResponse {
  message: string;
  token: string;
  admin: {
    id: number;
    name: string;
    username: string;
    email: string;
    type: string;
    status: number;
    profile_photo: string | null;
  };
}

interface ChangeStudentPasswordData {
  currentPassword: string;
  newPassword: string;
  user_id: number;
}

const getCurrentUserToken = () => {
  // First check if we're in a sub-user session
  const urlParams = new URLSearchParams(window.location.search);
  const subUserId = urlParams.get("subuser");

  // If in a sub-user session, use that user's token
  if (subUserId) {
    return localStorage.getItem(`token${subUserId}`);
  }

  // Otherwise use the main admin token
  const currentAdmin = localStorage.getItem("currentAdmin");
  if (currentAdmin) {
    return localStorage.getItem(`token${currentAdmin}`);
  }
  return null;
};
const handleApiError = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) {
      storage.clearSessionState();
      window.location.href = "/login";
      throw new Error("Session expired. Please log in again.");
    }
    if (error.response) {
      throw new Error(
        (error.response.data as any).message ||
          "An error occurred during the operation"
      );
    } else if (error.request) {
      throw new Error("No response from server. Please try again later.");
    }
  }
  throw new Error("Error setting up the request. Please try again.");
};
const getBasicHeaders = () => ({
  "Content-Type": "application/json",
});
export async function loginAdmin(credentials: LoginCredentials) {
  try {
    const response = await fetch(`${API_URL}/admin/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Login failed");
    }

    const data = await response.json();

    if (data.token) {
      localStorage.setItem(`token${data.admin.id}`, data.token);
    } else if (data.admin?.token) {
      localStorage.setItem(`token${data.admin.id}`, data.admin.token);
    }
    if (data.admin) {
      localStorage.setItem(`admin${data.admin.id}`, JSON.stringify(data.admin));
      // Add user ID to active users list
      addUserId(data.admin.id.toString());
      // Set as current admin
      localStorage.setItem("currentAdmin", data.admin.id.toString());
    }
    return data;
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
}

export async function logoutAdminSession() {
  try {
    await fetch(`${API_URL}/admin/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getCurrentUserToken() || ""}`,
        "Content-Type": "application/json",
      },
      credentials: "include",
    });
  } catch (error) {
    console.error("Logout request failed:", error);
  }
}

export async function loginAsSubUser(user_id: number, tb_id?: number) {
  try {
    const response = await fetch(`${API_URL}/admin/login/${user_id}/${tb_id}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Login failed");
    }

    const data = await response.json();

    if (data.token) {
      localStorage.setItem(`token${data.admin.id}`, data.token);
    } else if (data.admin?.token) {
      localStorage.setItem(`token${data.admin.id}`, data.admin.token);
    }
    if (data.admin) {
      localStorage.setItem(`admin${data.admin.id}`, JSON.stringify(data.admin));
      // Add user ID to active users list
      addUserId(data.admin.id.toString());
    }
    return data;
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
}
export const changeAdminPassword = async (data: ChangeStudentPasswordData) => {
  try {
    const response = await axios.put(`${API_URL}/admin/change-password`, data, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
};

export const changeStudentPassword = async (
  data: ChangeStudentPasswordData
) => {
  try {
    const response = await axios.put(
      `${API_URL}/admin/change-student-password`,
      data,
      {
        headers: getBasicHeaders(),
        validateStatus: (status) => status < 500,
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.message || "Password change failed");
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMessage =
        error.response?.data?.message || "Password change failed";
      throw new Error(errorMessage);
    }
    throw error;
  }
};
export async function getUserProfile() {
  try {
    const response = await axios.get(`${API_URL}/user/profile`, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.data) {
      throw new Error("No profile data received");
    }
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
}
export async function getAdminsProfile() {
  const response = await axios.get(`${API_URL}/admin/profile`, {
    headers: {
      Authorization: `Bearer ${getCurrentUserToken()}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.data) {
    throw new Error("No profile data received");
  }

  return response.data;
}
export async function updateAdminProfile(token: string, data: Partial<Admin>) {
  const response = await fetch(`${API_URL}/admin/profile`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to update profile");
  }

  return response.json();
}
export async function updateProfilePhoto(
  formData: UploadImageFormData,
  profilePhoto: File
) {
  try {
    const formDataToSend = new FormData();

    Object.entries(formData).forEach(([key, value]) => {
      formDataToSend.append(key, value);
    });

    formDataToSend.append("profile_photo", profilePhoto);

    const response = await axios.post(
      `${API_URL}/admin/update-profile-photo`,
      formDataToSend,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      const errorMessage =
        error.response?.data?.message ||
        "An error occurred while uploading the image";
      throw new Error(errorMessage);
    }
    throw error;
  }
}
export async function registerAdmin(
  formData: AdminFormData,
  profilePhoto?: File
): Promise<AdminResponse> {
  try {
    // Create FormData object
    const formDataToSend = new FormData();

    // Append all form fields
    Object.entries(formData).forEach(([key, value]) => {
      formDataToSend.append(key, value);
    });

    // Append profile photo if exists
    if (profilePhoto) {
      formDataToSend.append("profile_photo", profilePhoto);
    }

    const response = await axios.post(
      `${API_URL}/admin/register`,
      formDataToSend,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
}

export const validateFile = (file: File): string | null => {
  // Check file type
  if (!file.type.startsWith("image/")) {
    return "Please select an image file";
  }

  // Check file size (5MB limit)
  const maxSize = 5 * 1024 * 1024; // 5MB in bytes
  if (file.size > maxSize) {
    return "File size must be less than 5MB";
  }

  return null;
};
export async function createTrainingBatch(data: TrainingBatchFormData) {
  const response = await fetch(`${API_URL}/training_batches`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create training batch");
  }

  return response.json();
}
export async function getTrainingBatches() {
  const response = await axios.get(`${API_URL}/training_batches`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!response.data) {
    throw new Error("No Training batchs data received");
  }

  return response.data;
}
export async function getTrainingBatchById(id: string) {
  const response = await fetch(`${API_URL}/training_batches/${id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch training batch");
  }

  return response.json();
}
export async function createCenter(data: {
  center_name: string;
  center_location: string;
  center_type: string;
  center_medium: string;
  center_status: "0" | "1";
}) {
  const response = await fetch(`${API_URL}/center`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create training batch");
  }

  return response.json();
}
export async function getCenter() {
  const response = await fetch(`${API_URL}/center`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch training batches");
  }

  return response.json();
}
export async function createCenterDate(data: {
  center_id: number;
  tb_id: number;
  tb_start: string;
  tb_end: string;
}) {
  const response = await fetch(`${API_URL}/centersDates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create center date");
  }

  return response.json();
}
export async function getCentersWithDates(tb_id: number) {
  const response = await fetch(
    `${API_URL}/center/centers-with-dates/${tb_id}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch centers with dates");
  }

  return response.json();
}
export const createCourse = async (courseData: CourseFormData) => {
  try {
    const response = await axios.post(`${API_URL}/courses`, courseData);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data?.message || "Operation failed";
      throw new Error(errorMessage);
    }
  }
};
export const getAllCourse = async () => {
  try {
    const response = await axios.get(`${API_URL}/courses`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data?.message || "Operation failed";
      throw new Error(errorMessage);
    }
  }
};
export const getUserType = async () => {
  try {
    const response = await axios.get(`${API_URL}/user/type`);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data?.message || "Operation failed";
      throw new Error(errorMessage);
    }
  }
};
export const registerMasterTrainer = async (
  formData: MasterFromData,
  profilePhoto?: File
): Promise<MasterResponse> => {
  try {
    const formDataToSend = new FormData();

    // Append all form fields
    Object.entries(formData).forEach(([key, value]) => {
      formDataToSend.append(key, value);
    });

    // Append profile photo if exists
    if (profilePhoto) {
      formDataToSend.append("profile_photo", profilePhoto);
    }
    const response = await axios.post(
      `${API_URL}/mastertrainer/register`,
      formDataToSend,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
};
export const getMasterTrainersProfile = async () => {
  try {
    const response = await axios.get(`${API_URL}/mastertrainer/profile`, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
};
export const registerTrainer = async (
  formData: TrainerFormData,
  profilePhoto?: File
): Promise<TrainerResponse> => {
  try {
    const formDataToSend = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      formDataToSend.append(key, String(value));
    });
    if (profilePhoto) {
      formDataToSend.append("profile_photo", profilePhoto);
    }

    const response = await axios.post(
      `${API_URL}/trainer/register`,
      formDataToSend,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "multipart/form-data",
        },
      }
    );

    if (response.data.token) {
      localStorage.setItem("token", response.data.token);
    }

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
};
export const trainerCenterAllocation = async (
  formData: TrainerCenterAllocationFormData
): Promise<any> => {
  try {
    const response = await axios.post(
      `${API_URL}/trainersCenterAllocation/center-allocation`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
        validateStatus: (status) => status < 500,
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.message || "Operation failed");
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data?.message || "Operation failed";
      throw new Error(errorMessage);
    }
    throw error;
  }
};
export const getTrainersProfile = async (
  tb_id: number,
  center_id?: number,
  user_id?: number,
  user_type?: string
) => {
  try {
    const response = await axios.get(`${API_URL}/trainer/profile/${tb_id}`, {
      params: {
        tb_id: tb_id,
        ...(center_id ? { center_id: center_id } : {}),
        ...(user_id ? { user_id: user_id } : {}),
        ...(user_type ? { user_type: user_type } : {}),
      },

      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
};
export const getTrainersProfileByUser = async (
  tb_id: number,
  center_id?: number,
  user_id?: number,
  user_type?: string
) => {
  try {
    const response = await axios.get(
      `${API_URL}/trainer/profile-user/${tb_id}`,
      {
        params: {
          tb_id: tb_id,
          ...(center_id ? { center_id: center_id } : {}),
          ...(user_id ? { user_id: user_id } : {}),
          ...(user_type ? { user_type: user_type } : {}),
        },

        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
};
export const getTrainersForFeedBack = async (
  tb_id: number,
  user_id?: number
) => {
  try {
    const response = await axios.get(
      `${API_URL}/trainer/get-profile/${tb_id}/${user_id}`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
};
export const getAllTrainer = async () => {
  try {
    const response = await axios.get(`${API_URL}/trainer/profile`, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data?.message || "Operation failed";
      throw new Error(errorMessage);
    }
  }
};
export const registerStudent = async (
  data: StudentRegistrationData,
  profilePhoto?: File
) => {
  try {
    const formDataToSend = new FormData();

    // Append all form fields
    Object.entries(data).forEach(([key, value]) => {
      formDataToSend.append(key, String(value));
    });

    // Change field name to match backend
    if (profilePhoto) {
      formDataToSend.append("profile_photo", profilePhoto);
    }

    const response = await axios.post(
      `${API_URL}/student/register`,
      formDataToSend,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw error.response?.data || { message: "Registration failed" };
    }
    throw error;
  }
};
export const updateStudent = async (
  data: StudentRegistrationData,
  profilePhoto?: File
) => {
  try {
    const formDataToSend = new FormData();

    // Append all form fields
    Object.entries(data).forEach(([key, value]) => {
      formDataToSend.append(key, String(value));
    });

    // Change field name to match backend
    if (profilePhoto) {
      formDataToSend.append("profile_photo", profilePhoto);
    }

    const response = await axios.put(
      `${API_URL}/student/profile`,
      formDataToSend,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw error.response?.data || { message: "Registration failed" };
    }
    throw error;
  }
};
export const studentSuspension = async (
  std_cnic: string,
  suspension_reason: string
) => {
  try {
    const response = await axios.put(
      `${API_URL}/student/profile/SuspendStudentByCNIC`,
      {
        std_cnic: std_cnic,
        suspension_reason: suspension_reason,
      },
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw error.response?.data || { message: "Registration failed" };
    }
    throw error;
  }
};
export const studentUnSuspension = async (std_cnic: string) => {
  try {
    const response = await axios.put(
      `${API_URL}/student/profile/UnSuspendStudentByCNIC`,
      {
        std_cnic: std_cnic,
      },
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw error.response?.data || { message: "Registration failed" };
    }
    throw error;
  }
};
export const getStudentsProfile = async (
  tb_id?: number,
  center_id?: number,
  course_id?: number,
  user_id?: number,
  userType?: string
) => {
  try {
    const response = await axios.get(`${API_URL}/student/profile/${tb_id}`, {
      params: {
        tb_id: tb_id,
        ...(center_id ? { center_id: center_id } : {}),
        ...(course_id ? { course_id: course_id } : {}),
        ...(user_id ? { user_id: user_id } : {}),
        userType: userType,
      },
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
};
export const getStudentsByCNICProfile = async (std_cnic?: string) => {
  try {
    const response = await axios.get(
      `${API_URL}/student/getStudentProfileByCNIC/${std_cnic}`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
};
export const getStudentsByEmailProfile = async (user_email?: string) => {
  try {
    const response = await axios.get(
      `${API_URL}/student/getStudentProfileByEmail/${encodeURIComponent(
        user_email || ""
      )}`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
};
export const getStudentsByCNIC = async (std_cnic?: string) => {
  try {
    const response = await axios.get(
      `${API_URL}/student/getStudentByCNIC/${std_cnic}`,
      {
        headers: getBasicHeaders(),
      }
    );
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
};
export const getStudendByUserId = async (id: number) => {
  try {
    const response = await axios.get(
      `${API_URL}/student/getStudentById/${id}`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
};
export const submitStudentAttendance = async (
  attendanceRecords: StudentAttendanceInput[]
) => {
  try {
    const response = await axios.post(
      `${API_URL}/attendance/studentAttendance`,
      attendanceRecords,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      handleApiError(error);
    }
    throw error;
  }
};

export const getAttendanceHistory = async ({
  month,
  centerId,
  courseId,
  batchId,
  user_id,
}: {
  month: string;
  centerId: number;
  courseId: number;
  batchId: number;
  user_id: number;
}) => {
  try {
    const response = await axios.get(
      `${API_URL}/attendance/studentAttendancehstory`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
        params: {
          month,
          centerId,
          courseId,
          batchId,
          user_id,
        },
      }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      handleApiError(error);
    }
    throw error;
  }
};
export const getStudentAttendance = async (
  attendDate: string,
  centerId: number,
  courseId: number,
  selectedBatchId: number,
  user_id: number
) => {
  try {
    const response = await axios.get(
      `${API_URL}/attendance/studentAttendance`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
        params: {
          date: attendDate,
          centerId,
          courseId,
          batchId: selectedBatchId,
          user_id,
        },
      }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      handleApiError(error);
    }
    throw error;
  }
};

export const registerCandidate = async (
  data: CandidateFormData,
  profilePhoto?: File
) => {
  try {
    const formDataToSend = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      formDataToSend.append(
        key,
        value !== null && value !== undefined ? String(value) : ""
      );
    });

    if (profilePhoto) {
      formDataToSend.append("cand_photo", profilePhoto);
    }
    const response = await axios.post(
      `${API_URL}/candidateRoutes`,
      formDataToSend,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
};
export interface AdmissionControlRule {
  ac_id?: number;
  tb_id: number;
  center_id: number;
  course_id: number;
  allowed_gender: "all" | "male" | "female";
}

export const getPublicAdmissionControl = async (tb_id?: number) => {
  const query = tb_id ? `?tb_id=${tb_id}` : "";
  const response = await axios.get(`${API_URL}/admission-control/public${query}`, {
    headers: {
      "Content-Type": "application/json",
    },
  });
  return response.data as {
    success: boolean;
    totalOpen: number;
    rules: AdmissionControlRule[];
  };
};

export const getAdmissionControlAdmin = async () => {
  const response = await axios.get(`${API_URL}/admission-control/admin`, {
    headers: {
      Authorization: `Bearer ${getCurrentUserToken()}`,
      "Content-Type": "application/json",
    },
  });
  return response.data;
};

export const saveBatchAdmissionControl = async (data: {
  tb_id: number;
  rules: Array<{
    center_id: number;
    course_id: number;
    allowed_gender: "all" | "male" | "female";
  }>;
}) => {
  const response = await axios.post(`${API_URL}/admission-control/admin/save`, data, {
    headers: {
      Authorization: `Bearer ${getCurrentUserToken()}`,
      "Content-Type": "application/json",
    },
  });
  return response.data;
};

export const getCandidateProfileByCnic = async (cnic: string, tbId: number = 9) => {
  try {
    const response = await axios.get(
      `${API_URL}/candidateRoutes/check-cnic/${cnic}?tb_id=${tbId}`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
};
export const updateCandidateTestScore = async (
  data: UpdateCandidateTestScoreType
) => {
  try {
    const response = await axios.patch(
      `${API_URL}/candidateRoutes/update-test-marks/${data.cand_id}`,
      data,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error updating candidate test score:", error);
    throw error;
  }
};
export const getCandidateProfile = async (tb_id: number) => {
  try {
    const response = await axios.get(
      `${API_URL}/candidateRoutes/profile/${tb_id}`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
};
export const getSelectedCandidateProfile = async (tb_id: number) => {
  try {
    const response = await axios.get(
      `${API_URL}/candidateRoutes/selected/${tb_id}`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
};
export const postAssignment = async (
  data: AssignmentFormData,
  attachmentFile?: File
) => {
  try {
    const formDataToSend = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      formDataToSend.append(
        key,
        value !== null && value !== undefined ? String(value) : ""
      );
    });

    if (attachmentFile) {
      formDataToSend.append("assignment_attachment", attachmentFile);
    }
    const response = await axios.post(`${API_URL}/assignment`, formDataToSend, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "multipart/form-data",
      },
    });
    return response;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
};
export const getAssignmentList = async (tb_id: number, user_id: number) => {
  try {
    const response = await axios.get(`${API_URL}/assignment/${tb_id}`, {
      params: {
        user_id,
      },
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
};
export const deleteAssignment = async (as_id: number) => {
  try {
    const response = await axios.delete(`${API_URL}/assignment/${as_id}`, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
};
export const updateAssignment = async (
  as_id: number,
  data: AssignmentFormData,
  attachmentFile?: File
) => {
  try {
    const formDataToSend = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      formDataToSend.append(
        key,
        value !== null && value !== undefined ? String(value) : ""
      );
    });

    if (attachmentFile) {
      formDataToSend.append("assignment_attachment", attachmentFile);
    }

    const response = await axios.put(
      `${API_URL}/assignment/${as_id}`,
      formDataToSend,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
};
export const submitTrainerAttendance = async (
  attendanceData: TrainerAttendanceInput
) => {
  try {
    const response = await axios.post(
      `${API_URL}/trainerAttendance`,
      attendanceData,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error submitting attendance:", error);
    throw error;
  }
};
export const getTrainerAttendanceByBatch = async (tb_id: number) => {
  try {
    const response = await axios.get(
      `${API_URL}/api/trainerAttendance/batch/${tb_id}`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
};
export async function registerCenterUser(
  formData: CenterUserFormData,
  profilePhoto?: File
): Promise<AdminResponse> {
  try {
    // Create FormData object
    const formDataToSend = new FormData();

    // Append all form fields
    Object.entries(formData).forEach(([key, value]) => {
      formDataToSend.append(key, value);
    });

    // Append profile photo if exists
    if (profilePhoto) {
      formDataToSend.append("profile_photo", profilePhoto);
    }

    const response = await axios.post(
      `${API_URL}/centerUser/register`,
      formDataToSend,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
}
export const getCenterUsers = async () => {
  try {
    const response = await axios.get(`${API_URL}/centerUser/profile`, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};
export const getCenterUserProfileByUserId = async (user_id: number) => {
  try {
    const response = await axios.get(
      `${API_URL}/centerUser/profile/${user_id}`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};
export const createEarning = async (
  data: EarningFormData,
  earningProof?: File
) => {
  try {
    const formDataToSend = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      formDataToSend.append(key, value);
    });
    if (earningProof) {
      formDataToSend.append("earning_proofs", earningProof);
    }
    const response = await axios.post(
      `${API_URL}/earnings/create`,
      formDataToSend,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
};
export const getEarnings = async (tb_id: number, user_id: number) => {
  try {
    const response = await axios.get(`${API_URL}/earnings/profile/${tb_id}`, {
      params: {
        user_id,
        tb_id,
      },
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    throw error;
  }
};
export const getEarningsByTBId = async (tb_id: number, user_id: number) => {
  try {
    const response = await axios.get(
      `${API_URL}/earnings/earning-report/${tb_id}/${user_id}`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    throw error;
  }
};
export const getEarningsReport = async () => {
  try {
    const response = await axios.get(
      `${API_URL}/earnings/earning-master-report`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    throw error;
  }
};
export const updateEarningStatus = async (
  earningId: number,
  status: number
) => {
  try {
    const response = await axios.patch(
      `${API_URL}/earnings/update-status/${earningId}`,
      { earning_status: status },
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    throw error;
  }
};
export const StudentLeave = async (data: StudentLeaveFormData) => {
  try {
    const formDataToSend = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      formDataToSend.append(
        key,
        value !== null && value !== undefined ? String(value) : ""
      );
    });

    const response = await axios.post(
      `${API_URL}/studentLeave/leaves`,
      formDataToSend,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      handleApiError(error);
    }
    throw error;
  }
};
export const TrainerLeave = async (data: TrainersLeaveFormData) => {
  try {
    const formDataToSend = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      formDataToSend.append(
        key,
        value !== null && value !== undefined ? String(value) : ""
      );
    });

    const response = await axios.post(
      `${API_URL}/trainerLeave/leaves`,
      formDataToSend,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      handleApiError(error);
    }
    throw error;
  }
};
export const getStudentLeave = async (user_id: number) => {
  try {
    const response = await axios.get(
      `${API_URL}/studentLeave/leaves/${user_id}`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};
export const getStudentLeaveAsTrainer = async (
  user_id: number,
  tb_id: number
) => {
  try {
    const response = await axios.get(
      `${API_URL}/studentLeave/leaves-trainer/${user_id}/${tb_id}`,

      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};
export const updateStudentLeave = async (
  sl_code: number,
  status: number,
  trainerComment: string
) => {
  try {
    const response = await axios.put(
      `${API_URL}/studentLeave/leaves-status/${sl_code}`,
      {
        sl_code: sl_code,
        sl_status: status,
        sl_trainer_comments: trainerComment,
      },
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};
export const getTrainerLeave = async (user_id: number, tb_id: number) => {
  try {
    const response = await axios.get(
      `${API_URL}/trainerLeave/leaves/${user_id}/${tb_id}`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};
export const getTrainerLeaveAsMTOrAdmin = async (
  user_id: number,
  tb_id: number,
  user_type: string
) => {
  try {
    const response = await axios.get(
      `${API_URL}/trainerLeave/leaves-trainer_by_mt_ad/${user_id}/${tb_id}/${user_type}`,

      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};
export const updateTrainerLeave = async (
  tl_code: number,
  status: number,
  tl_mt_comments: string
) => {
  try {
    const response = await axios.put(
      `${API_URL}/trainerLeave/leaves-status/${tl_code}`,
      {
        tl_code: tl_code,
        tl_status: status,
        tl_mt_comments: tl_mt_comments,
      },
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};
export const updateTrainerLeaveByAdmin = async (
  tl_code: number,
  status: number,
  tl_admin_comments: string
) => {
  try {
    const response = await axios.put(
      `${API_URL}/trainerLeave/leaves-admin-status/${tl_code}`,
      {
        tl_code: tl_code,
        tl_status: status,
        tl_admin_comments: tl_admin_comments,
      },
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};
export const addHoliday = async (data: HolidayFormProps) => {
  try {
    const response = await axios.post(`${API_URL}/holidays/`, data, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};
export const getHolidays = async (tb_id: number) => {
  try {
    const response = await axios.get(`${API_URL}/holidays/${tb_id}`, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};
export const StudentDocument = async (
  data: StudentDocumentFormData,
  documentFile: File,
  std_user_id: number
) => {
  try {
    const formDataToSend = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      formDataToSend.append(key, value);
    });
    if (documentFile) {
      formDataToSend.append("student_docs", documentFile);
    }
    const response = await axios.post(
      `${API_URL}/studentDocs/`,
      formDataToSend,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
};
export const getStudentDocuments = async (user_id: number) => {
  try {
    const response = await axios.get(`${API_URL}/studentDocs/${user_id}`, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};
export const updateStudentDocuments = async (
  id: number,
  doc_status: number
) => {
  try {
    const response = await axios.put(
      `${API_URL}/studentDocs/${id}`,
      { doc_status },
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};
export const getActiveLogs = async (tb_id: number) => {
  try {
    const response = await axios.get(`${API_URL}/activityLog/all/${tb_id}`, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};
export const getFreelancerProfiles = async (user_id: number) => {
  try {
    const response = await axios.get(`${API_URL}/freelancing/${user_id}`, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    throw error;
  }
};
export const updateFreelancerProfiles = async (
  id: number,
  sfp_status: number
) => {
  try {
    const response = await axios.put(
      `${API_URL}/freelancing/${id}`,
      { sfp_status },
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    throw error;
  }
};

export const createFreelancerProfile = async (
  formData: FreelanceProfile
): Promise<FreelanceProfile> => {
  try {
    const response = await axios.post(`${API_URL}/freelancing/`, formData, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
};
export const createQuiz = async () => {
  try {
    const response = await axios.post(`${API_URL}/quiz`, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};
export const submitFeedback = async (data: FeedbackSubmission) => {
  try {
    const response = await axios.post(`${API_URL}/feedback/`, data, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};
export const getFeedbackByTbId = async (tb_id: number) => {
  try {
    const response = await axios.get(`${API_URL}/feedback/tb/${tb_id}`, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      handleApiError(error);
    }
    throw error;
  }
};

export const getFeedbackByTbIdCenterIdCourseId = async (
  tb_id: number,
  center_id: number,
  course_id: number
) => {
  try {
    const response = await axios.get(
      `${API_URL}/feedback/tb/${tb_id}/center/${center_id}/course/${course_id}`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      handleApiError(error);
    }
    throw error;
  }
};

export const getFeedbackForTrainer = async (tb_id: number, user_id: number) => {
  try {
    const response = await axios.get(
      `${API_URL}/feedback/tb/${tb_id}/trainer/${user_id}`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      handleApiError(error);
    }
    throw error;
  }
};
export const createQuizQuestion = async (
  data: QuizFormData,
  tb_id: number,
  t_id: number
) => {
  try {
    const response = await axios.post(
      `${API_URL}/quiz/create/${tb_id}/${t_id}`,
      { data },
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};
export const getTeacherQuizzes = async (
  userId: number,
  tb_id: number
): Promise<Quiz[]> => {
  try {
    const response = await fetch(`${API_URL}/quiz/teacher/${userId}/${tb_id}`, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      throw new Error("Failed to fetch quizzes");
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error fetching teacher quizzes:", error);
    return [];
  }
};
export const getStudentQuizResultList = async (quiz_code: string) => {
  try {
    const response = await axios.get(`${API_URL}/quiz/results/${quiz_code}`, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    const data = response.data;
    console.log("API Response for Quiz Results:", data); // Debugging log
    return data;
  } catch (error) {
    console.error("Error in getStudentQuizResultList:", error);
    return [];
  }
};
export const getStudentQuizzes = async (userId: number, tb_id: number) => {
  try {
    const response = await fetch(`${API_URL}/quiz/student/${userId}/${tb_id}`, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      throw new Error("Failed to fetch quizzes");
    }
    return response.json();
  } catch (error) {
    console.error("Error fetching teacher quizzes:", error);
    return [];
  }
};
export const createQuizAttempt = async (data: QuizAttemptFormData) => {
  try {
    const response = await axios.post(`${API_URL}/quiz/start`, data, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};
export const submitQuiz = async (
  data: QuizSubmission
): Promise<QuizSubmissionResponse> => {
  try {
    const response = await axios.post(`${API_URL}/quiz/submit`, data, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};
export const updateQuiz = async (quizCode: string, data: any) => {
  try {
    const response = await axios.put(
      `${API_URL}/quiz/update/${quizCode}`,
      data,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    throw error;
  }
};

export const deleteQuiz = async (quizCode: string) => {
  try {
    const response = await axios.delete(`${API_URL}/quiz/delete/${quizCode}`, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    throw error;
  }
};
export const getDailyReport = async (
  tb_id: number,
  t_id: number,
  userType: string,
  center_id: number,
  course_id: number
) => {
  try {
    const response = await axios.get(
      `${API_URL}/dailyLectureReport/${tb_id}/${t_id}/${userType}/${center_id}/${course_id}`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
};
export const createDailyReport = async (data: DailyReportFormData) => {
  try {
    const response = await axios.post(`${API_URL}/dailyLectureReport/`, data, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
};
export const getStudentDashboardData = async (
  user_id: number,
  tb_id: number,
  userType: string
): Promise<DashboardData> => {
  try {
    const response = await axios.get(
      `${API_URL}/dashboard/student/${user_id}/${tb_id}/${userType}`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};
export const getTrainersDashboardData = async (
  user_id: number,
  tb_id: number,
  userType: string
): Promise<TrainerDashboardData> => {
  try {
    const response = await axios.get(
      `${API_URL}/dashboard/trainer/${user_id}/${tb_id}/${userType}`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};
export const getMasterTrainerDashoard = async (
  user_id: number,
  tb_id: number,
  userType: string
): Promise<MasterTrainerDashboardData> => {
  try {
    const response = await axios.get(
      `${API_URL}/dashboard/master-trainer/${user_id}/${tb_id}/${userType}`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};
export const submitStudentAssignement = async (
  formData: {
    std_rollno: string;
    tb_id: number;
    as_id: number;
    as_submission_comment: string;
  },
  attachmentFile?: File
) => {
  try {
    const formDataToSend = new FormData();

    // Append all form fields
    Object.entries(formData).forEach(([key, value]) => {
      formDataToSend.append(key, String(value));
    });

    // Append file if it exists
    if (attachmentFile) {
      formDataToSend.append("assignment_attachment", attachmentFile);
    }

    const response = await axios.post(
      `${API_URL}/assignment-submissions/`,
      formDataToSend,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
};
export const getStudentAssignmentSubmits = async (
  as_id: number,
  std_rollno: string
) => {
  try {
    const response = await axios.get(
      `${API_URL}/assignment-submissions/${as_id}/${std_rollno}`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};
export const sendForgotPasswordEmail = async (email: string) => {
  try {
    const response = await axios.post(
      `${API_URL}/admin/forgot-password`,
      { user_email: email },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};
export const resetPassword = async (
  email: string,
  code: string,
  newPassword: string
) => {
  try {
    const response = await axios.post(
      `${API_URL}/admin/reset-password`,
      { user_email: email, verification_code: code, new_password: newPassword },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const createAnnouncement = async (formData: AnnouncementFormData) => {
  try {
    const response = await axios.post(`${API_URL}/announcements`, formData, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      handleApiError(error);
    }
    throw error;
  }
};

export const updateAnnouncement = async (
  ca_id: number,
  formData: AnnouncementFormData
) => {
  try {
    const response = await axios.put(
      `${API_URL}/announcements/${ca_id}`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      handleApiError(error);
    }
    throw error;
  }
};

export const deleteAnnouncement = async (ca_id: number) => {
  try {
    const response = await axios.delete(`${API_URL}/announcements/${ca_id}`, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      handleApiError(error);
    }
    throw error;
  }
};

export const getAnnouncements = async (
  tb_id: number,
  user_id: number,
  user_type: string
) => {
  try {
    const response = await axios.get(`${API_URL}/announcements`, {
      params: { tb_id, user_id, user_type },
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      handleApiError(error);
    }
    throw error;
  }
};
export const notifyStudents = async (data: {
  course_id: number;
  center_id: number;
  tb_id: number;
  subject: string;
  message: string;
}) => {
  try {
    const response = await axios.post(
      `${API_URL}/announcements/notify-students`,
      data,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      handleApiError(error);
    }
    throw error;
  }
};

// Ticket API functions
export const getTickets = async (params: {
  tb_id?: number;
  center_id?: number;
  course_id?: number;
  user_type?: string;
  user_id?: number;
}) => {
  try {
    const response = await axios.get(`${API_URL}/tickets/all`, {
      params,
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
};

export const getTicketById = async (
  id: number,
  user_id: number,
  tb_id: number
) => {
  try {
    const response = await axios.get(
      `${API_URL}/tickets/${id}/${user_id}/${tb_id}`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
};

export const createTicket = async (
  ticketData: TicketFormData,
  profilePhoto?: File
) => {
  try {
    const formDataToSend = new FormData();

    // Append all form fields
    Object.entries(ticketData).forEach(([key, value]) => {
      formDataToSend.append(key, String(value));
    });

    // Change field name to match backend
    if (profilePhoto) {
      formDataToSend.append("ticket_attachment", profilePhoto);
    }
    const response = await axios.post(`${API_URL}/tickets/create`, ticketData, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
};

export const updateTicket = async (id: number, ticketData: FormData) => {
  try {
    const response = await axios.put(`${API_URL}/tickets/${id}`, ticketData, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
};

export const createTicketReply = async (
  replyData: TicketReplyFormData,
  profilePhoto?: File
) => {
  try {
    const formDataToSend = new FormData();

    // Append all form fields
    Object.entries(replyData).forEach(([key, value]) => {
      formDataToSend.append(key, String(value));
    });

    // Change field name to match backend
    if (profilePhoto) {
      formDataToSend.append("ticket_attachment", profilePhoto);
    }
    const response = await axios.post(
      `${API_URL}/tickets/reply`,
      formDataToSend,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
    return response.data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
};

export const getTicketReplies = async (ticket_no: string) => {
  try {
    const response = await axios.get(
      `${API_URL}/tickets/replies/${ticket_no}`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
};
export const getAssignmentSubmissionsByBatch = async (
  tb_id: number,
  user_id: number,
  as_id: number
) => {
  try {
    const response = await axios.get(
      `${API_URL}/assignment-submissions/getAssignmentSubmission/${tb_id}/${user_id}/${as_id}`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
};

export const updateAssignmentSubmission = async (
  submissionId: number,
  data: {
    trainer_comments?: string;
    obt_marks?: string;
    as_submission_status?: number;
  }
) => {
  try {
    const response = await axios.put(
      `${API_URL}/assignment-submissions/${submissionId}`,
      data,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
};

export const updateCandidateInterviewData = async (
  candidateId: number,
  data: {
    cand_interview_marks: string;
    basicSkills: string;
    personality: string;
    freelancing: string;
    courseDomain: string;
    hasLaptop: boolean;
    isRecommended: boolean;
    courseTrack: string;
    centerPriority: string;
  }
) => {
  try {
    const response = await axios.put(
      `${API_URL}/candidateRoutes/interview-data/${candidateId}`,
      {
        cand_interview_marks: data.cand_interview_marks,
        basicSkills: data.basicSkills,
        personality: data.personality,
        freelancing: data.freelancing,
        courseDomain: data.courseDomain,
        hasLaptop: data.hasLaptop,
        isRecommended: data.isRecommended,
        courseTrack: data.courseTrack,
        centerPriority: data.centerPriority,
      },
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw (
        error.response?.data || { message: "Failed to update interview data" }
      );
    }
    throw error;
  }
};

export const suspendCandidate = async (
  candidateId: number,
  rejectReason: string
) => {
  try {
    const response = await axios.put(
      `${API_URL}/candidateRoutes/suspend/${candidateId}`,
      { rejectReason },
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw error.response?.data || { message: "Failed to suspend candidate" };
    }
    throw error;
  }
};

// Exam Assessment APIs
export const getExamAssessments = async (
  tb_id: number,
  user_type: string,
  user_id: number,
  ea_type: string
) => {
  try {
    const response = await axios.get(
      `${API_URL}/examAssessment/${tb_id}/${user_type}/${user_id}/${ea_type}`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    handleApiError(error);
    return { success: false, data: [] };
  }
};
export const getExamAssessmentsByTbId = async (
  tb_id: number,
  std_cnic: string,
  ea_type: string
) => {
  try {
    const response = await axios.get(
      `${API_URL}/examAssessment/${std_cnic}/${tb_id}/${ea_type}`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    handleApiError(error);
    return { success: false, data: [] };
  }
};

export const getExamAssessmentById = async (id: number) => {
  try {
    const response = await axios.get(`${API_URL}/examAssessment/${id}`, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    handleApiError(error);
    return { success: false, data: null };
  }
};
export const getExamAssessmentAll = async () => {
  try {
    const response = await axios.get(`${API_URL}/examAssessment/all`, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    handleApiError(error);
    return { success: false, data: null };
  }
};

export const createExamAssessment = async (assessmentData: any) => {
  try {
    const response = await axios.post(
      `${API_URL}/examAssessment`,
      assessmentData,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    handleApiError(error);
    return { success: false, message: "Failed to create exam assessment" };
  }
};

export const updateExamAssessment = async (id: number, assessmentData: any) => {
  try {
    const response = await axios.put(
      `${API_URL}/examAssessment/${id}`,
      assessmentData,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    handleApiError(error);
    return { success: false, message: "Failed to update exam assessment" };
  }
};

export const deleteExamAssessment = async (id: number) => {
  try {
    const response = await axios.delete(`${API_URL}/examAssessment/${id}`, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    handleApiError(error);
    return { success: false, message: "Failed to delete exam assessment" };
  }
};
export const deleteEarning = async (earningId: number) => {
  try {
    const response = await axios.delete(`${API_URL}/earnings/${earningId}`, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};
export const getEarningsByTrainer = async (tb_id: number, user_id: number) => {
  try {
    const response = await axios.get(
      `${API_URL}/earnings/earning-report-trainer/${tb_id}/${user_id}`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};
export const getStudentFeedBack = async (
  tb_id: number,
  user_id: number,
  userType: string
) => {
  try {
    const response = await axios.get(

      `${API_URL}/feedback/${tb_id}/${user_id}/${userType}`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Learning Resources API calls
export const createLearningResource = async (
  formData: LearningResourceData,
  file?: File | null
) => {
  try {
    // Create FormData object
    const formDataToSend = new FormData();

    // Append all form fields to FormData
    Object.entries(formData).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        formDataToSend.append(key, String(value));
      }
    });

    // Add file if provided
    if (file) {
      formDataToSend.append("ls_attachment", file);
    }

    const response = await axios.post(
      `${API_URL}/learning-resources`,
      formDataToSend,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
};

export const getLearningResources = async (params: {
  tb_id?: number;
  center_id?: number;
  course_id?: number;
  t_id?: number;
  userType?: string;
}) => {
  try {
    const response = await axios.get(`${API_URL}/learning-resources`, {
      params,
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
};

export const updateLearningResource = async (
  id: number,
  formData: LearningResourceData
) => {
  try {
    const response = await axios.put(
      `${API_URL}/learning-resources/${id}`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
};

export const deleteLearningResource = async (id: number) => {
  try {
    const response = await axios.delete(`${API_URL}/learning-resources/${id}`, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
};

// Lecture Recordings API calls
export const createLectureRecording = async (
  formData: LectureRecordingData,
  file?: File | null
) => {
  try {
    // Create FormData object
    const formDataToSend = new FormData();

    // Append form data fields to FormData
    Object.entries(formData).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        formDataToSend.append(key, String(value));
      }
    });

    // Add file if provided (with correct field name)
    if (file) {
      formDataToSend.append("lr_attachment", file);
    }
    const response = await axios.post(
      `${API_URL}/lecture-recordings`,
      formDataToSend,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
};

export const getLectureRecordings = async (params: {
  tb_id?: number;
  center_id?: number;
  course_id?: number;
  t_id?: number;
  userType?: string;
}) => {
  try {
    const response = await axios.get(`${API_URL}/lecture-recordings`, {
      params,
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
};

export const updateLectureRecording = async (
  id: number,
  formData: LectureRecordingData,
  file?: File
) => {
  try {
    const formDataToSend = new FormData();

    // Append form data fields to FormData
    Object.entries(formData).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        formDataToSend.append(key, String(value));
      }
    });

    // Add file if provided (with correct field name)
    if (file) {
      formDataToSend.append("lr_attachment", file);
    }

    const response = await axios.put(
      `${API_URL}/lecture-recordings/${id}`,
      formDataToSend,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return response.data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
};

export const deleteLectureRecording = async (id: number) => {
  try {
    const response = await axios.delete(`${API_URL}/lecture-recordings/${id}`, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    handleApiError(error);
    throw error;
  }
};
export const createCertificate = async (certificateData: any) => {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_BACKEND_URL}/api/certificate/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(certificateData),
      }
    );
    if (!response.ok) {
      throw new Error("Failed to generate certificate");
    }
    // Get the blob and trigger download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `certificate-${certificateData.name}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    return { success: true };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
};
export const sendStudentMail = async (params: {
  email: string;
  subject: string;
  message: string;
}) => {
  try {
    const response = await axios.post(`${API_URL}/student/send-mail`, params, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error: any) {
    if (axios.isAxiosError(error) && error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw error;
  }
};
export const getCenterUserDashoard = async (user_id: number, tb_id: number) => {
  try {
    const response = await axios.get(
      `${API_URL}/dashboard/center-user/${user_id}/${tb_id}`,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};
export const createCourseModule = async (data: CourseModuleFormData, file?: File) => {
  console.log("Creating Course Module with Data:", data);
  const formDataToSend = new FormData();

  Object.entries(data).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      if (Array.isArray(value) || typeof value === "object") {
        formDataToSend.append(key, JSON.stringify(value));
      } else {
        formDataToSend.append(key, String(value));
      }
    }
  });

  if (file) {
    formDataToSend.append("module_image", file);
  }

  // Debug: Log all FormData key-value pairs
  console.log("FormData content:");
  for (let pair of formDataToSend.entries()) {
    console.log(pair[0] + ':', pair[1]);
  }

  const response = await axios.post(`${API_URL}/course-modules`, formDataToSend,
    {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "multipart/form-data",
      },
    }
  );
  return response.data;
};

export const updateCourseModule = async (id: number, data: CourseModuleFormData, file?: File) => {
  const formDataToSend = new FormData();

  Object.entries(data).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      if (Array.isArray(value) || typeof value === "object") {
        formDataToSend.append(key, JSON.stringify(value));
      } else {
        formDataToSend.append(key, String(value));
      }
    }
  });

  if (file) {
    formDataToSend.append("module_image", file);
  }

  const response = await axios.put(`${API_URL}/course-modules/${id}`, formDataToSend, {
    headers: {
      Authorization: `Bearer ${getCurrentUserToken()}`,
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const deleteCourseModule = async (id: number) => {
  const response = await axios.delete(`${API_URL}/course-modules/${id}`, {
    headers: {
      Authorization: `Bearer ${getCurrentUserToken()}`,
      "Content-Type": "application/json",
    },
  });
  return response.data;
};
export const getCourseModules = async (tb_id: number, course_id: number, center_id: number) => {
  const response = await axios.get(
    `${API_URL}/course-modules/${tb_id}/${course_id}/${center_id}`,
    {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
};

// Trainer Topic Report API functions
export const getTrainerTopicReports = async (params?: {
  trainer_id?: number;
  tb_id?: number;
  module_id?: number;
}) => {
  const queryParams = new URLSearchParams();
  if (params?.trainer_id) queryParams.append('trainer_id', params.trainer_id.toString());
  if (params?.tb_id) queryParams.append('tb_id', params.tb_id.toString());
  if (params?.module_id) queryParams.append('module_id', params.module_id.toString());

  const response = await axios.get(
    `${API_URL}/trainer-topic-reports?${queryParams.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
};

export const markTopicCompleted = async (data: {
  trainer_id: number;
  tb_id: number;
  course_id: number;
  center_id: number;
  module_id: number;
  topic_id: number;
  remarks?: string;
}) => {
  const response = await axios.post(
    `${API_URL}/trainer-topic-reports/mark-completed`,
    data,
    {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    }
  );
  return response.data;
};
