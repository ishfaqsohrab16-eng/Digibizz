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
    return localStorage.getItem(`token${currentAdmin}`) || "";
  }

  // Empty string, not null. Every call site builds the header as
  // `Bearer ${getCurrentUserToken()}`, and null was interpolated into the
  // literal text "Bearer null" - which the server then tried to verify as a
  // token and rejected as "Invalid token", making a signed-out session look
  // like a tampered one. An empty string produces `Bearer `, which reads
  // correctly as no session at all.
  return "";
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
    const loginIdentifier = credentials.user_username.trim();
    const normalizedCredentials = {
      ...credentials,
      user_username: loginIdentifier.includes("@")
        ? loginIdentifier.toLowerCase()
        : loginIdentifier,
    };

    const response = await fetch(`${API_URL}/admin/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(normalizedCredentials),
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

export const resetStudentPasswordByAdmin = async (
  userId: number,
  newPassword: string
) => {
  try {
    const response = await axios.put(
      `${API_URL}/admin/reset-student-password`,
      {
        user_id: userId,
        newPassword,
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
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
    throw error;
  }
};

export const getAppSettings = async () => {
  try {
    const response = await axios.get(`${API_URL}/admin/app-settings`, {
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

export const updateAppSettings = async (settings: {
  requireStudentDocuments: boolean;
}) => {
  try {
    const response = await axios.put(`${API_URL}/admin/app-settings`, settings, {
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
/**
 * Only the batches this trainer is actually allocated to.
 *
 * The sidebar previously picked a trainer's batches by their position in the
 * full list, so a newly created batch was offered to every trainer even with no
 * class assigned in it - and selecting it produced a broken dashboard.
 * Same response shape as getTrainingBatches, so callers are interchangeable.
 */
export async function getTrainingBatchesForTrainer(user_id: number) {
  const response = await axios.get(
    `${API_URL}/training_batches/for-trainer/${user_id}`,
    {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    }
  );
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

export const getClassSchedules = async (tbId: number) => {
  try {
    const response = await axios.get(`${API_URL}/class-schedules/${tbId}`, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data?.message || "Failed to load class schedules";
      throw new Error(errorMessage);
    }
    throw error;
  }
};

export const saveClassSchedule = async (payload: {
  center_id: number;
  course_id: number;
  tb_id: number;
  cs_start_date: string;
  cs_class_days: string;
  cs_start_time: string;
  cs_end_time: string;
  cs_note?: string;
}) => {
  try {
    const response = await axios.post(`${API_URL}/class-schedules`, payload, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data?.message || "Failed to save class schedule";
      throw new Error(errorMessage);
    }
    throw error;
  }
};

export const deleteClassSchedule = async (csId: number) => {
  try {
    const response = await axios.delete(`${API_URL}/class-schedules/${csId}`, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const errorMessage = error.response?.data?.message || "Failed to delete class schedule";
      throw new Error(errorMessage);
    }
    throw error;
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

export interface AttendanceCalendarDay {
  date: string;
  /** null means the class ran but this student was never marked. */
  status: "P" | "A" | "L" | null;
}

export interface AttendanceCalendarResponse {
  student: {
    std_cnic: string;
    std_rollno: string;
    center_id: number;
    course_id: number;
    tb_id: number;
    center_name: string;
    course_name: string;
    enrolled_on: string | null;
  };
  firstMarkedDate: string | null;
  daysCounted: number;
  present: number;
  absent: number;
  leave: number;
  unmarkedDays: number;
  classDaysSinceFirstMark: number;
  percentage: number;
  days: AttendanceCalendarDay[];
}

/**
 * Day-by-day attendance for one student.
 *
 * Students may omit std_cnic - the server always resolves them to their own
 * record and ignores any CNIC they send. Staff pass the student's CNIC.
 */
export const getStudentAttendanceCalendar = async (params?: {
  std_cnic?: string;
  tb_id?: number;
}): Promise<AttendanceCalendarResponse> => {
  try {
    const response = await axios.get(`${API_URL}/attendance/student-calendar`, {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        "Content-Type": "application/json",
      },
      params,
    });
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

/**
 * Look up a candidate by CNIC within a specific batch.
 *
 * `tbId` is REQUIRED and has deliberately no default. It used to default to 9,
 * which silently pinned every caller to Batch 9: once candidates were moved to
 * Batch 10 the Interview Panel searched the wrong batch and reported "not
 * found", while its heading still read "Batch 10" (that comes from BatchContext).
 * Callers must pass the batch they are actually showing.
 */
export const getCandidateProfileByCnic = async (cnic: string, tbId: number) => {
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
  status: number,
  /** Required when status is 2 (rejected); the server rejects a blank one. */
  rejectReason?: string
) => {
  try {
    const response = await axios.patch(
      `${API_URL}/earnings/update-status/${earningId}`,
      { earning_status: status, earning_reject_reason: rejectReason },
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
    const response = await axios.post(
      `${API_URL}/studentLeave/leaves`,
      data,
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
/** Whether the signed-in student may submit feedback this week. */
export const getFeedbackWindow = async () => {
  const response = await axios.get(`${API_URL}/feedback/window`, {
    headers: {
      Authorization: `Bearer ${getCurrentUserToken()}`,
      "Content-Type": "application/json",
    },
  });
  return response.data as {
    success: boolean;
    canSubmit: boolean;
    week: string;
    weekLabel: string;
    submittedOn: string | null;
    message: string;
  };
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
    if (error instanceof AxiosError) {
      handleApiError(error);
    }
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
      { user_email: email.trim().toLowerCase() },
      {
        headers: {
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
export const resetPassword = async (
  email: string,
  code: string,
  newPassword: string
) => {
  try {
    const response = await axios.post(
      `${API_URL}/admin/reset-password`,
      {
        user_email: email.trim().toLowerCase(),
        verification_code: code,
        new_password: newPassword,
      },
      {
        headers: {
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

export interface EnrollmentPreview {
  success: boolean;
  candidate: {
    cand_id: number;
    name: string;
    father_name: string;
    cnic: string;
    email: string;
    phone: string;
    gender: string;
    qualification: string;
    district: string;
    recommended: string;
    admission_status: number;
    is_uob_student: boolean | null;
  };
  enrollment: {
    center_id: number;
    center_name: string;
    course_id: number;
    course_name: string;
    tb_id: number;
    batch_name: string;
  };
  alreadyEnrolled: { std_id: number; std_rollno: string } | null;
  eligible: boolean;
}

// ---------------------------------------------------------------------------
// Data assistant (Super Admin only)
// ---------------------------------------------------------------------------

/** One thing the assistant wants drawn, already checked against the rows. */
export type AiVisual =
  | { type: "table"; title: string; queryIndex: number }
  | { type: "stat"; title: string; queryIndex: number; valueField: string }
  | {
      /** Anything plotted on x/y: one entry in yFields per series. */
      type: "bar" | "hbar" | "stackedBar" | "line" | "area" | "radar" | "scatter";
      title: string;
      queryIndex: number;
      xField: string;
      yFields: string[];
      labelField?: string;
    }
  | {
      /** One label and one number per row. */
      type: "pie" | "donut" | "treemap" | "funnel" | "radial" | "list";
      title: string;
      queryIndex: number;
      labelField: string;
      valueField: string;
    };

/** One column of a result, summarised over every row of it. */
export interface AiColumnProfile {
  name: string;
  type: "number" | "text" | "date";
  /**
   * What the column is FOR, which decides what is worth showing.
   *
   * A quantity gets a total; an identity does not, because the sum of four
   * primary keys is a real number about nothing. Decided on the server so the
   * card and the model agree.
   */
  role?: "measure" | "identifier" | "category" | "constant" | "unique" | "date";
  missing: number;
  present: number;
  /** number */
  min?: number;
  max?: number;
  sum?: number;
  mean?: number;
  /** date */
  earliest?: string;
  latest?: string;
  /** text */
  distinct?: number;
  top?: Array<{ value: string; count: number }>;
  /** The single value, when every row shares one. */
  value?: string;
}

/**
 * The statistics the answer was based on.
 *
 * Computed on the server over the whole result and sent here, rather than
 * recomputed in the browser - two implementations of "the average" would
 * eventually disagree, and the one on screen has to be the one the model was
 * given.
 */
export interface AiProfile {
  rowCount: number;
  columns: AiColumnProfile[];
}

/** What it ran to get there. Shown so the answer can be checked. */
export interface AiQuery {
  sql: string;
  reason: string;
  rowCount: number;
  ms: number;
  rows: Array<Record<string, any>>;
  profile?: AiProfile;
}

export interface AiAnswer {
  success: boolean;
  answered: boolean;
  summary: string;
  visuals: AiVisual[];
  queries: AiQuery[];
  rounds: number;
  ms: number;
  /** Which model answered. The router chose it; nobody asked for it. */
  model?: string;
  /** How the router reached it, as "freellm:<upstream provider>". */
  provider?: string;
}

/** What is left of the router's own request allowance for this window. */
export interface AiQuota {
  provider: string;
  model: string;
  remaining: number | null;
  limit: number | null;
  resetsIn: number;
  /** Requests, not tokens - the router meters its own traffic that way. */
  unit?: string;
}

export interface AiStatus {
  success: boolean;
  ready: boolean;
  /** True when queries run as a SELECT-only database account. */
  readOnlyAccount: boolean;
  /**
   * Always "auto". There is no picker: the router is handed the question and
   * picks whichever free model is both usable right now and able to call
   * tools, which is a decision only it can make.
   */
  model?: string;
  /** How many models the router has to choose between. */
  routerModels?: number;
  /** The screening model, when the router can reach one. */
  screening?: string | null;
  quota?: AiQuota;
  tables?: number;
  maxRows?: number;
  message: string | null;
}

export const getAiStatus = async () => {
  const response = await axios.get(`${API_URL}/ai-assistant/status`, {
    headers: { Authorization: `Bearer ${getCurrentUserToken()}` },
  });
  return response.data as AiStatus;
};

export const askAiAssistant = async (
  question: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  /**
   * Identifies the train of thought, so data fetched for one question can
   * answer the next without querying again.
   */
  conversationId?: string
) => {
  const response = await axios.post(
    `${API_URL}/ai-assistant/ask`,
    // No model is named. The server picks whichever of its models still has a
    // token allowance this minute, Cerebras before Groq, and reports which
    // one answered.
    { question, history, conversationId },
    {
      headers: { Authorization: `Bearer ${getCurrentUserToken()}` },
      // Five minutes, and it is the server that decides when to stop, not
      // this. A question can now sit out a short rate limit rather than
      // failing - every free provider being busy for twenty seconds is the
      // normal state of a free tier - and it makes up to eight model calls.
      // The server's own budget is 270s, so anything reaching this timeout is
      // genuinely stuck rather than merely slow.
      timeout: 300000,
    }
  );
  return response.data as AiAnswer;
};

/** Details for the confirmation popup shown before enrolling a candidate. */
export const getEnrollmentPreview = async (
  candId: number
): Promise<EnrollmentPreview> => {
  try {
    const response = await axios.get(
      `${API_URL}/candidateRoutes/enrollment-preview/${candId}`,
      {
        headers: { Authorization: `Bearer ${getCurrentUserToken()}` },
      }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) handleApiError(error);
    throw error;
  }
};


// ---------------------------------------------------------------------------
// Bulk enrolment from an uploaded CNIC list
// ---------------------------------------------------------------------------

/** What the server says will happen - or did happen - to one row of the file. */
export type BulkEnrollStatus =
  | "ready"
  | "enrolled"
  | "already_enrolled"
  | "not_recommended"
  | "not_found"
  | "no_email"
  | "email_taken"
  | "phone_taken"
  | "failed";

export interface BulkEnrollRow {
  cnic: string;
  /** The CNIC in the form printed on the card, for showing back. */
  formatted: string;
  /** The spreadsheet row it came from, so a problem can be found and fixed. */
  line: number;
  status: BulkEnrollStatus;
  message: string;
  cand_id?: number;
  name?: string;
  email?: string;
  std_rollno?: string;
  /** True when this person was not marked recommended but is enrolled anyway. */
  unrecommended?: boolean;
}

/** A row that could not be read as a CNIC at all. */
export interface BulkEnrollSkippedRow {
  line: number;
  raw: string;
  reason: string;
}

export interface BulkEnrollSummary {
  readable: number;
  ready: number;
  already_enrolled: number;
  /** Only the single-enrolment path produces this; a bulk upload never does. */
  not_recommended: number;
  /** Being enrolled despite no recommendation, so the count is visible. */
  unrecommended_included: number;
  not_found: number;
  no_email: number;
  email_taken: number;
  phone_taken: number;
  unreadable: number;
}

export interface BulkEnrollPreview {
  success: boolean;
  rowsInFile: number;
  summary: BulkEnrollSummary;
  plan: BulkEnrollRow[];
  skipped: BulkEnrollSkippedRow[];
}

export interface BulkEnrollResult {
  success: boolean;
  message: string;
  rowsInFile: number;
  enrolled: number;
  failed: number;
  results: BulkEnrollRow[];
  skipped: BulkEnrollSkippedRow[];
  note?: string;
}

/**
 * Download the CSV template.
 *
 * Fetched as a blob rather than linked to directly: the endpoint needs the
 * Authorization header, which a plain <a href> cannot send.
 */
export const downloadEnrollmentCnicTemplate = async () => {
  const response = await axios.get(
    `${API_URL}/candidateRoutes/bulk-enroll/template`,
    {
      headers: { Authorization: `Bearer ${getCurrentUserToken()}` },
      responseType: "blob",
    }
  );

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "enrollment-cnic-template.csv");
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

/** Dry run: says who would be enrolled, without writing anything. */
export const previewBulkEnrollment = async (file: File, tbId: number | string) => {
  const form = new FormData();
  form.append("file", file);
  form.append("tb_id", String(tbId));

  const response = await axios.post(
    `${API_URL}/candidateRoutes/bulk-enroll/preview`,
    form,
    { headers: { Authorization: `Bearer ${getCurrentUserToken()}` } }
  );
  return response.data as BulkEnrollPreview;
};

/**
 * Enrol everyone in the file who is eligible.
 *
 * The file is sent again rather than a list of ids from the preview: the
 * server re-checks against the database as it is now, so a candidate enrolled
 * by hand in the meantime is not enrolled twice.
 */
export const bulkEnrollByCnic = async (file: File, tbId: number | string) => {
  const form = new FormData();
  form.append("file", file);
  form.append("tb_id", String(tbId));

  const response = await axios.post(`${API_URL}/candidateRoutes/bulk-enroll`, form, {
    headers: { Authorization: `Bearer ${getCurrentUserToken()}` },
    // Hundreds of enrolments, each its own transaction. The default timeout
    // would abandon a run that is still succeeding.
    timeout: 300000,
  });
  return response.data as BulkEnrollResult;
};

/** Enrol a recommended candidate as a student. */
export const enrollCandidate = async (
  candId: number,
  overrides?: { center_id?: number; course_id?: number; tb_id?: number; std_rollno?: string }
) => {
  try {
    const response = await axios.post(
      `${API_URL}/candidateRoutes/enroll/${candId}`,
      overrides || {},
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) handleApiError(error);
    throw error;
  }
};

/** Move a candidate to a different center and/or course. SuperAdmin only. */
export const changeCandidateCenterCourse = async (
  candId: number,
  payload: { center_id?: number; course_id?: number; reason?: string }
) => {
  try {
    const response = await axios.patch(
      `${API_URL}/candidateRoutes/change-center-course/${candId}`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${getCurrentUserToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) handleApiError(error);
    throw error;
  }
};

/**
 * Permanently delete a student and every record linked to them.
 * Irreversible. SuperAdmin only - the server enforces this too.
 */
export const purgeStudent = async (stdId: number) => {
  try {
    const response = await axios.delete(`${API_URL}/student/${stdId}/purge`, {
      headers: { Authorization: `Bearer ${getCurrentUserToken()}` },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) handleApiError(error);
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
    /** null when the interviewer was not asked (non-UoB centers). */
    isUobStudent?: boolean | null;
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
        isUobStudent: data.isUobStudent ?? null,
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

// ---------------------------------------------------------------------------
// Email campaigns (SuperAdmin only - the server enforces the same)
// ---------------------------------------------------------------------------

/**
 * A campaign: a name, a subject, one piece of static HTML, and a list of
 * addresses uploaded from a spreadsheet.
 *
 * The `ec_*` fields marked LEGACY belong to the admissions-era module, when a
 * campaign was scoped to a center and batch and rendered a built-in letter per
 * candidate. They are still returned for campaigns sent before that changed,
 * and are null on every new one.
 */
export interface EmailCampaign {
  ec_id: number;
  ec_name: string;
  ec_subject: string;
  /** The email body. Static - every recipient receives this exact markup. */
  ec_custom_html?: string | null;
  ec_target_count: number;
  ec_batch_size: number;
  ec_interval_minutes: number;
  ec_min_gap_seconds: number;
  ec_max_gap_seconds: number;
  ec_status: "draft" | "running" | "paused" | "completed" | "cancelled";
  ec_last_run_at?: string | null;
  ec_next_run_at?: string | null;
  createdAt?: string;
  stats?: CampaignStats;

  // LEGACY - historical campaigns only.
  tb_id?: number | null;
  center_id?: number | null;
  ec_kind?: "initial" | "reminder" | "recommendation" | "general" | null;
  ec_audience?: "candidates" | "students" | "list" | null;
  ec_source_campaign_id?: number | null;
  ec_interview_date?: string | null;
  ec_interview_time?: string | null;
  ec_reporting_time?: string | null;
  ec_venue?: string | null;
  ec_contact_person?: string | null;
  ec_contact_phone?: string | null;
  ec_message?: string | null;
}

export interface CampaignStats {
  pending: number;
  sent: number;
  failed: number;
  skipped: number;
  total: number;
}

const campaignHeaders = () => ({
  Authorization: `Bearer ${getCurrentUserToken()}`,
  "Content-Type": "application/json",
});

/**
 * What is left of today's sending allowance.
 *
 * Brevo's free plan is 300 emails a day across everything, and part of it is
 * held back for registration codes - so a campaign larger than what remains
 * finishes tomorrow. Shown on the screen because an operator who is not told
 * reads that pause as a fault.
 */
export interface SendingAllowance {
  provider: string;
  date: string;
  total: number;
  transactional: number;
  campaign: number;
  dailyLimit: number;
  reserve: number;
  remainingForCampaigns: number;
  remainingTotal: number;
}

export const getEmailCampaigns = async () => {
  const response = await axios.get(`${API_URL}/email-campaigns`, {
    headers: campaignHeaders(),
  });
  return response.data as {
    success: boolean;
    campaigns: EmailCampaign[];
    allowance?: SendingAllowance;
  };
};

export const getEmailCampaign = async (id: number) => {
  const response = await axios.get(`${API_URL}/email-campaigns/${id}`, {
    headers: campaignHeaders(),
  });
  return response.data as {
    success: boolean;
    campaign: EmailCampaign;
    stats: CampaignStats;
  };
};

/** One row per address on a campaign's frozen send list. */
export interface CampaignRecipientRow {
  ecr_id: number;
  ecr_email: string;
  ecr_name: string | null;
  ecr_status: "pending" | "sent" | "failed" | "skipped";
  ecr_sent_at: string | null;
  ecr_attempts: number;
  ecr_error: string | null;
}

export const getCampaignRecipients = async (
  id: number,
  params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    search?: string;
  }
) => {
  const response = await axios.get(
    `${API_URL}/email-campaigns/${id}/recipients`,
    { params, headers: campaignHeaders() }
  );
  return response.data as {
    success: boolean;
    total: number;
    page: number;
    pageSize: number;
    recipients: CampaignRecipientRow[];
  };
};

export interface CreateCampaignPayload {
  ec_name: string;
  ec_subject: string;
  /** The email body. Sent to every address exactly as written. */
  ec_custom_html: string;
  ec_batch_size: number;
  ec_interval_minutes: number;
  ec_min_gap_seconds: number;
  ec_max_gap_seconds: number;
  recipientList: UploadedRecipient[];
  startNow: boolean;
}

export const createEmailCampaign = async (payload: CreateCampaignPayload) => {
  const response = await axios.post(`${API_URL}/email-campaigns`, payload, {
    headers: campaignHeaders(),
  });
  return response.data as {
    success: boolean;
    message: string;
    campaign: EmailCampaign;
    queued: number;
  };
};

/** Refused by the server while a campaign is running - pause or cancel first. */
export const deleteEmailCampaign = async (id: number) => {
  const response = await axios.delete(`${API_URL}/email-campaigns/${id}`, {
    headers: campaignHeaders(),
  });
  return response.data as { success: boolean; message: string };
};

export const setCampaignStatus = async (
  id: number,
  action: "start" | "pause" | "cancel"
) => {
  const response = await axios.post(
    `${API_URL}/email-campaigns/${id}/status/${action}`,
    {},
    { headers: campaignHeaders() }
  );
  return response.data;
};

export const sendCampaignChunkNow = async (id: number) => {
  const response = await axios.post(
    `${API_URL}/email-campaigns/${id}/send-now`,
    {},
    { headers: campaignHeaders() }
  );
  return response.data as { success: boolean; message: string; sent: number };
};

export const previewCampaignEmail = async (payload: Record<string, unknown>) => {
  const response = await axios.post(
    `${API_URL}/email-campaigns/preview`,
    payload,
    { headers: campaignHeaders() }
  );
  // No "rendered for" metadata: the body is static, so the preview is the
  // message every single recipient receives, not a sample personalised for one.
  return response.data as {
    success: boolean;
    subject: string;
    html: string;
  };
};

/**
 * Trigger a browser download of a CSV the server generates.
 *
 * Fetched as a blob with the auth header rather than pointed at with a plain
 * link: these endpoints require a bearer token, which a normal navigation
 * cannot send.
 */
const downloadBlob = async (url: string, params: Record<string, unknown>) => {
  const response = await axios.get(url, {
    params,
    headers: { Authorization: `Bearer ${getCurrentUserToken()}` },
    responseType: "blob",
  });

  const disposition = String(response.headers?.["content-disposition"] || "");
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || "recipients.csv";

  const href = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in some browsers.
  window.setTimeout(() => window.URL.revokeObjectURL(href), 1000);
};

/** Download the frozen recipient list of an existing campaign. */
export const downloadCampaignRecipients = (id: number) =>
  downloadBlob(`${API_URL}/email-campaigns/${id}/recipients/export`, {});

/** Send the dummy proof copy to the configured test addresses. */
export const sendCampaignTest = async (id: number) => {
  const response = await axios.post(
    `${API_URL}/email-campaigns/${id}/test`,
    {},
    { headers: campaignHeaders() }
  );
  return response.data as {
    success: boolean;
    message: string;
    sent: string[];
    failed: Array<{ to: string; error: string }>;
  };
};

/** Starter HTML for the custom-email editor, served from the backend file. */
export const getCampaignStarterTemplate = async () => {
  const response = await axios.get(
    `${API_URL}/email-campaigns/starter-template`,
    { headers: campaignHeaders() }
  );
  return response.data as { success: boolean; html: string };
};

// ---------------------------------------------------------------------------
// Email confirmation for the public registration form. No auth header: the
// applicant has no account yet.
// ---------------------------------------------------------------------------

/**
 * The server answers within ~8s even when the mail server is slow (it finishes
 * the send in the background), so a request still running at 25s means the
 * network or the server itself, not the mail. Without a timeout the button
 * spins forever on a dropped connection, which is what a stalled mobile
 * connection looks like to an applicant.
 */
const VERIFY_TIMEOUT_MS = 25000;

export const sendEmailVerificationCode = async (email: string) => {
  const response = await axios.post(
    `${API_URL}/email-verification/send-code`,
    { email },
    { timeout: VERIFY_TIMEOUT_MS }
  );
  return response.data as {
    success: boolean;
    message: string;
    expiresInMinutes: number;
    resendAfterSeconds: number;
  };
};

export const confirmEmailVerificationCode = async (
  email: string,
  code: string
) => {
  const response = await axios.post(
    `${API_URL}/email-verification/verify-code`,
    { email, code },
    { timeout: VERIFY_TIMEOUT_MS }
  );
  return response.data as {
    success: boolean;
    verified: boolean;
    message: string;
  };
};

/**
 * Is this email or phone free to register with?
 *
 * Called as the registration form is filled in. No auth header: the
 * applicant has no account yet.
 */
export const checkContactAvailability = async (contact: {
  email?: string;
  phone?: string;
  /**
   * The batch being applied to. Without it the server cannot tell a
   * returning applicant from a duplicate - the same details are free in a
   * new batch even if they applied in an old one.
   */
  tb_id?: number | string;
}) => {
  const response = await axios.get(
    `${API_URL}/candidateRoutes/contact-available`,
    { params: contact, timeout: 15000 }
  );
  return response.data as ContactAvailability;
};

export interface ContactAvailability {
  success: boolean;
  available: boolean;
  /** Per field, so the form can mark one and leave the other alone. */
  emailTaken: boolean;
  phoneTaken: boolean;
  fields: Array<"email" | "phone">;
  field: "email" | "phone" | null;
  message: string | null;
}

/** Survives a page refresh, so a confirmed address is not re-verified. */
export const getEmailVerificationStatus = async (email: string) => {
  const response = await axios.get(`${API_URL}/email-verification/status`, {
    params: { email },
    timeout: VERIFY_TIMEOUT_MS,
  });
  return response.data as { success: boolean; verified: boolean };
};

/**
 * One address from an uploaded sheet.
 *
 * `name` is carried only so the recipient table and CSV export are readable.
 * It is NOT merged into the email - the body is static.
 */
export interface UploadedRecipient {
  email: string;
  name?: string;
  line?: number;
}

/** The one-column CSV operators fill in before uploading. */
export const downloadCampaignListTemplate = () =>
  downloadBlob(`${API_URL}/email-campaigns/list-template`, {});

/**
 * Parse an uploaded spreadsheet. Nothing is stored: the rows come back to the
 * browser and are posted again with the campaign, so an abandoned upload
 * leaves no list of addresses on the server.
 */
export const uploadCampaignRecipientList = async (file: File) => {
  const body = new FormData();
  body.append("file", file);

  const response = await axios.post(
    `${API_URL}/email-campaigns/upload-list`,
    body,
    {
      headers: {
        Authorization: `Bearer ${getCurrentUserToken()}`,
        // Content-Type is deliberately omitted: the browser must set it so the
        // multipart boundary is included, and naming it here would drop that.
      },
    }
  );

  return response.data as {
    success: boolean;
    message?: string;
    /** Rows in the file, including any that were skipped. */
    total: number;
    /** Usable addresses, after dropping blanks, malformed rows and duplicates. */
    accepted: number;
    recipients: UploadedRecipient[];
    skipped: Array<{ line: number; email: string; reason: string }>;
    maxRows: number;
  };
};


/* ---------------------------------------------------------------------------
 * Weekly M&E report on trainer performance
 *
 * A Master Trainer files one per trainer per week; admins read them and see
 * which are missing. Mirrors the paper form "DigiBizz Program Weekly M&E
 * Report - Trainers Performance".
 * ------------------------------------------------------------------------- */

/** One of the five teaching days, with the real date its column heads. */
export interface EvalDay {
  key: "mon" | "tue" | "wed" | "thu" | "fri";
  label: string;
  date: string;
}

/** Monday to Friday, keyed as an ISO week. */
export interface EvalWeek {
  key: string;
  start: string;
  end: string;
  days: EvalDay[];
}

export interface EvalCriterion {
  key: string;
  label: string;
  /** True for the one row the LMS can answer for itself. */
  auto?: boolean;
}

export interface EvalClass {
  center_id: number;
  course_id: number;
  tb_id: number;
  center_name: string;
  course_name: string;
  tb_name: string;
  /**
   * Whether this centre was actually teaching in the week being reported on.
   *
   * Centres inside one batch have their own start and end dates, so in the
   * first weeks one may be running and another not yet open.
   */
  active?: boolean;
  dates?: { start: string; end: string } | null;
}

/** When teaching ran, across the centres in scope. */
export interface EvalWindow {
  start: string;
  end: string;
  byCentre: Record<string, { start: string; end: string }>;
}

/**
 * A figure the LMS worked out, and how.
 *
 * `source` is shown beside the field: "counted from the lecture reports" and
 * "nothing in the system records this" are different kinds of blank, and an MT
 * who cannot tell them apart will either distrust a good number or accept a
 * missing one.
 */
export interface EvalFigure {
  value: number | null;
  source: "counted" | "audit" | "unavailable";
  note: string;
}

/** Present, absent and on leave for one teaching day. */
export interface EvalAttendanceDay {
  P: number;
  A: number;
  L: number;
  /** False when nobody marked the register that day, which is itself a finding. */
  marked: boolean;
}

export interface EvalMetrics {
  classes: Array<{ center_id: number; course_id: number; tb_id: number }>;
  lecture_reports: Record<string, boolean>;
  attendance: Record<string, EvalAttendanceDay>;
  assignments: EvalFigure;
  quizzes: EvalFigure;
  enrolled_start: EvalFigure;
  new_enrolled: EvalFigure;
  dropouts: EvalFigure;
  on_leave: EvalFigure;
  mt_visit_date: EvalFigure;
  quality: EvalFigure;
  feedback_submission: EvalFigure;
}

export interface EvalReport {
  we_id: number;
  t_id: number;
  mt_id: number;
  we_week_key: string;
  we_week_start: string;
  we_week_end: string;
  we_daily: Record<string, Record<string, boolean>>;
  we_attendance: Record<string, EvalAttendanceDay> | null;
  we_custom_label: string | null;
  we_assignments: number | null;
  we_quizzes: number | null;
  we_quality: string | null;
  we_mt_visit_date: string | null;
  we_enrolled_start: number | null;
  we_dropouts: number | null;
  we_new_enrolled: number | null;
  we_on_leave: number | null;
  we_feedback_submission: string | null;
  we_other_tasks: string | null;
  we_remarks: string | null;
  we_classes: EvalClass[] | null;
  we_auto: EvalMetrics | null;
  we_status: "draft" | "submitted" | "reviewed";
  we_submitted_on: string | null;
  /** The second signature: who read it, when, and anything they said. */
  we_reviewed_by: number | null;
  we_reviewed_by_name: string | null;
  we_reviewed_on: string | null;
  we_review_note: string | null;
  trainer?: { t_id: number; t_cnic: string; user?: { user_name: string } };
}

export interface EvalTrainerRow {
  t_id: number;
  name: string;
  email: string | null;
  cnic: string;
  classes: EvalClass[];
  report: {
    we_id: number;
    status: "draft" | "submitted" | "reviewed";
    submitted_on: string | null;
    reviewed_on?: string | null;
    reviewed_by_name?: string | null;
  } | null;
}

const evalAuth = () => ({
  headers: { Authorization: `Bearer ${getCurrentUserToken()}` },
});

/**
 * The trainers this Master Trainer evaluates in one batch.
 *
 * Trainers are found by COURSE through their allocation, so only those with a
 * class in the batch come back at all.
 */
export const getMyTrainersForEvaluation = async (tb_id: number, week?: string) => {
  const response = await axios.get(`${API_URL}/weekly-evaluations/my-trainers`, {
    ...evalAuth(),
    params: { tb_id, ...(week ? { week } : {}) },
  });
  return response.data as {
    success: boolean;
    week: EvalWeek;
    weeks: EvalWeek[];
    window: EvalWindow | null;
    inWindow: boolean;
    trainers: EvalTrainerRow[];
  };
};

/** One trainer's form for one week of one batch, pre-filled from the LMS. */
export const prepareEvaluation = async (t_id: number, tb_id: number, week?: string) => {
  const response = await axios.get(`${API_URL}/weekly-evaluations/prepare`, {
    ...evalAuth(),
    params: { t_id, tb_id, ...(week ? { week } : {}) },
  });
  return response.data as {
    success: boolean;
    week: EvalWeek;
    weeks: EvalWeek[];
    window: EvalWindow | null;
    inWindow: boolean;
    criteria: EvalCriterion[];
    grades: string[];
    trainer: { t_id: number; name: string; email: string | null; cnic: string };
    classes: EvalClass[];
    metrics: EvalMetrics | null;
    report: EvalReport | null;
    editable: boolean;
  };
};

/**
 * What a Master Trainer actually fills in.
 *
 * The countable figures are absent on purpose. Assignments, quizzes, enrolment,
 * drop-outs, leave and which days a lecture report was filed all come from the
 * database and are written by the server; sending them would achieve nothing.
 * What is left is everything nothing can count: the observations, the grades
 * and the remarks.
 */
export interface EvaluationDraft {
  t_id: number;
  tb_id: number;
  week_key: string;
  status: "draft" | "submitted";
  daily: Record<string, Record<string, boolean>>;
  custom_label?: string | null;
  quality?: string | null;
  mt_visit_date?: string | null;
  feedback_submission?: string | null;
  other_tasks?: string | null;
  remarks?: string | null;
}

export const saveEvaluation = async (draft: EvaluationDraft) => {
  const response = await axios.post(`${API_URL}/weekly-evaluations`, draft, evalAuth());
  return response.data as { success: boolean; message: string; report: EvalReport };
};

/**
 * Every report written about one trainer, newest week first.
 *
 * Without a batch this spans all of them, which is what someone reviewing a
 * person over time wants to see.
 */
export const getEvaluationHistory = async (t_id: number, tb_id?: number) => {
  const response = await axios.get(`${API_URL}/weekly-evaluations/history`, {
    ...evalAuth(),
    params: { t_id, ...(tb_id ? { tb_id } : {}) },
  });
  return response.data as { success: boolean; reports: EvalReport[] };
};

export const getEvaluation = async (we_id: number) => {
  const response = await axios.get(`${API_URL}/weekly-evaluations/${we_id}`, evalAuth());
  return response.data as {
    success: boolean;
    report: EvalReport;
    criteria: EvalCriterion[];
    week: EvalWeek;
    editable: boolean;
    reviewable: boolean;
  };
};

export interface EvalOverviewRow {
  t_id: number;
  name: string;
  master_trainer: string | null;
  mt_id: number | null;
  teaching: boolean;
  status: "submitted" | "reviewed" | "draft" | "missing";
  we_id: number | null;
  quality: string | null;
  submitted_on: string | null;
}

/** Every trainer in a batch for one week, reported on or not. Missing is the point. */
export const getEvaluationOverview = async (tb_id: number, week?: string) => {
  const response = await axios.get(`${API_URL}/weekly-evaluations/overview`, {
    ...evalAuth(),
    params: { tb_id, ...(week ? { week } : {}) },
  });
  return response.data as {
    success: boolean;
    week: EvalWeek;
    weeks: EvalWeek[];
    window: EvalWindow | null;
    /** False for a week filed on paper, before this module took over. */
    chased: boolean;
    startWeek: string;
    rows: EvalOverviewRow[];
    summary: {
      teaching: number;
      submitted: number;
      reviewed: number;
      draft: number;
      missing: number;
    };
  };
};

/**
 * Mark a report as read, or withdraw that.
 *
 * The second signature on the paper form. It changes nothing the report says -
 * a reviewer who disagrees has a conversation - and the Master Trainer can see
 * it has happened, which is the point of recording it.
 */
export const reviewEvaluation = async (
  we_id: number,
  options: { reviewed?: boolean; note?: string } = {}
) => {
  const response = await axios.post(
    `${API_URL}/weekly-evaluations/${we_id}/review`,
    { reviewed: options.reviewed !== false, note: options.note ?? null },
    evalAuth()
  );
  return response.data as { success: boolean; message: string; report: EvalReport };
};

/** What this Master Trainer still owes, for the dashboard reminder. */
export const getEvaluationsPending = async () => {
  const response = await axios.get(`${API_URL}/weekly-evaluations/pending`, evalAuth());
  return response.data as {
    success: boolean;
    pending: Array<{ week: EvalWeek; outstanding: number }>;
    trainers?: number;
  };
};


/* ---------------------------------------------------------------------------
 * Weekly centre visit
 *
 * A Master Trainer goes to every centre with a class running, fills in the
 * Visit Report Proforma, and attaches photographs or video. A Super Admin
 * reads it and marks it reviewed.
 *
 * One report per centre per week across ALL Master Trainers - a centre is
 * visited, not visited-by-each-of-us. The Online Cell is one virtual centre
 * standing for every online and hybrid centre, and follows the same rule.
 * ------------------------------------------------------------------------- */

export interface VisitQuestion {
  key: string;
  label: string;
}

/** Yes or No, and the note that explains it. */
export interface VisitAnswer {
  answer: "Yes" | "No" | null;
  note: string | null;
}

export interface VisitMedia {
  file: string;
  type: "image" | "video";
  size: number;
}

export interface VisitCenter {
  center_id: number;
  center_name: string;
  medium: string;
  /** True for the single virtual centre covering online and hybrid. */
  online_cell: boolean;
  dates: { start: string; end: string } | null;
  visit: {
    cv_id: number;
    status: "draft" | "submitted" | "reviewed";
    visit_date: string | null;
    submitted_on: string | null;
    media: number;
    by: string | null;
    /** True when the person looking is the one who started it. */
    mine: boolean;
  } | null;
}

export interface CenterVisit {
  cv_id: number;
  mt_id: number;
  cv_center_id: number;
  cv_center_name: string;
  tb_id: number;
  cv_week_key: string;
  cv_week_start: string;
  cv_week_end: string;
  cv_visit_date: string | null;
  cv_visit_time: string | null;
  cv_answers: Record<string, VisitAnswer>;
  cv_remarks: string | null;
  cv_media: VisitMedia[] | null;
  cv_status: "draft" | "submitted" | "reviewed";
  cv_submitted_on: string | null;
  cv_reviewed_by_name: string | null;
  cv_reviewed_on: string | null;
  cv_review_note: string | null;
}

/** Every centre needing a visit this week, and who has been. */
export const getVisitCenters = async (tb_id: number, week?: string) => {
  const response = await axios.get(`${API_URL}/center-visits/centers`, {
    ...evalAuth(),
    params: { tb_id, ...(week ? { week } : {}) },
  });
  return response.data as {
    success: boolean;
    week: EvalWeek;
    weeks: EvalWeek[];
    chased: boolean;
    centers: VisitCenter[];
  };
};

/** The form for one centre. */
export const prepareVisit = async (tb_id: number, center_id: number, week?: string) => {
  const response = await axios.get(`${API_URL}/center-visits/prepare`, {
    ...evalAuth(),
    params: { tb_id, center_id, ...(week ? { week } : {}) },
  });
  return response.data as {
    success: boolean;
    week: EvalWeek;
    weeks: EvalWeek[];
    questions: VisitQuestion[];
    center: VisitCenter;
    visit: CenterVisit | null;
    filed_by: string | null;
    editable: boolean;
    /** Somebody else got there first. Shown read-only rather than hidden. */
    claimed: boolean;
    reviewable: boolean;
  };
};

/**
 * Save a visit, as a draft or submitted.
 *
 * Multipart, because photographs and video come with it. The answers travel as
 * a JSON string: multipart cannot carry a nested object on its own.
 */
export const saveVisit = async (input: {
  tb_id: number;
  center_id: number;
  week_key: string;
  status: "draft" | "submitted";
  answers: Record<string, VisitAnswer>;
  visit_date?: string | null;
  visit_time?: string | null;
  remarks?: string | null;
  media?: File[];
}) => {
  const form = new FormData();
  form.append("tb_id", String(input.tb_id));
  form.append("center_id", String(input.center_id));
  form.append("week_key", input.week_key);
  form.append("status", input.status);
  form.append("answers", JSON.stringify(input.answers));
  if (input.visit_date) form.append("visit_date", input.visit_date);
  if (input.visit_time) form.append("visit_time", input.visit_time);
  if (input.remarks) form.append("remarks", input.remarks);
  for (const file of input.media || []) form.append("media", file);

  const response = await axios.post(`${API_URL}/center-visits`, form, {
    headers: { Authorization: `Bearer ${getCurrentUserToken()}` },
    // Video off a phone is easily tens of megabytes on a slow connection.
    timeout: 600000,
  });
  return response.data as { success: boolean; message: string; visit: CenterVisit };
};

export const removeVisitMedia = async (cv_id: number, file: string) => {
  const response = await axios.post(
    `${API_URL}/center-visits/${cv_id}/media/remove`,
    { file },
    evalAuth()
  );
  return response.data as { success: boolean; visit: CenterVisit };
};

export const getVisit = async (cv_id: number) => {
  const response = await axios.get(`${API_URL}/center-visits/${cv_id}`, evalAuth());
  return response.data as {
    success: boolean;
    visit: CenterVisit;
    questions: VisitQuestion[];
    filed_by: string | null;
    week: EvalWeek | null;
    reviewable: boolean;
  };
};

export interface VisitOverviewRow {
  center_id: number;
  center_name: string;
  online_cell: boolean;
  status: "draft" | "submitted" | "reviewed" | "missing";
  cv_id: number | null;
  by: string | null;
  visit_date: string | null;
  visit_time: string | null;
  media: number;
}

/** Every centre for one week, visited or not. The unvisited rows are the point. */
export const getVisitOverview = async (tb_id: number, week?: string) => {
  const response = await axios.get(`${API_URL}/center-visits/overview`, {
    ...evalAuth(),
    params: { tb_id, ...(week ? { week } : {}) },
  });
  return response.data as {
    success: boolean;
    week: EvalWeek;
    weeks: EvalWeek[];
    chased: boolean;
    rows: VisitOverviewRow[];
    summary: {
      centers: number;
      submitted: number;
      reviewed: number;
      draft: number;
      missing: number;
    };
  };
};

export const reviewVisit = async (
  cv_id: number,
  options: { reviewed?: boolean; note?: string } = {}
) => {
  const response = await axios.post(
    `${API_URL}/center-visits/${cv_id}/review`,
    { reviewed: options.reviewed !== false, note: options.note ?? null },
    evalAuth()
  );
  return response.data as { success: boolean; message: string; visit: CenterVisit };
};

/** How many centres this Master Trainer still owes a visit, for the dashboard. */
export const getVisitsPending = async () => {
  const response = await axios.get(`${API_URL}/center-visits/pending`, evalAuth());
  return response.data as { success: boolean; pending: number; week?: EvalWeek };
};
