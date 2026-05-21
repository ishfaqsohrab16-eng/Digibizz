export interface StudentRegistrationData {
  std_rollno: string;
  std_cnic: string;
  user_name: string;
  user_username: string;
  std_fathername: string;
  std_gender: string;
  std_qualification: string;
  std_district: string;
  user_email: string;
  std_phone: string;
  user_password: string;
  confirm_password: string;
  user_type: string;
  user_status?: number;
  course_id: number;
  center_id: number;
  t_id: number;
  dark_mode?: string;
  special_case?: number;
  special_case_comments?: string;
  earnings?: number;
  profile_photo?: File;
  tb_id?: number;
}

export interface StudentAttendanceInput {
  std_cnic: string;
  attend_date: string;
  tb_id: number;
  user_id: number;
  attend_status: string;
}

export interface DashboardResponse {
  statistics: Array<{
    label: string;
    value: string;
  }>;
  recentAssignments: Array<{
    title: string;
    points: number;
    deadline: string;
  }>;
  courseProgressData: Array<{
    name: string;
    value: number;
  }>;
  quizPerformanceData: Array<{
    name: string;
    value: number;
  }>;
  assignmentPerformanceData: Array<{
    name: string;
    value: number;
  }>;
  dashboardStats: {
    earnings: number;
    pendingAssignments: number;
    pendingQuizzes: number;
    overallProgress: number;
    attendanceProgress: number;
  };
  latestAnnouncement?: {
    ca_title: string;
    ca_message: string;
  };
}
