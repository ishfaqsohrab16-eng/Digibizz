export interface ExamAssessment {
  ea_id: number;
  std_cnic: string;
  tb_id: number;
  center_id: number;
  course_id: number;
  ea_type: "MID" | "FINAL";
  class_participation: number;
  final_task: number;
  presentation: number;
  viva: number;
  total_score: number;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: string;
}

interface User {
  user_id: number;
  user_name: string;
  user_username: string;
  user_email: string;
  user_profile_photo: string;
  user_type: string;
  user_status: number;
  createdAt: string;
  updatedAt: string;
}

interface Student {
  std_id: number;
  user_id: number;
  std_rollno: string;
  std_cnic: string;
  std_fathername: string;
  std_gender: string;
  std_qualification: string;
  std_district: string;
  std_phone: string;
  tb_id: number;
  course_id: number;
  center_id: number;
  dark_mode: number;
  std_added_on: string;
  std_lms_status: number;
  std_forum_status: number;
  suspension_reason: string;
  special_case: string;
  special_case_comments: string;
  createdAt: string;
  updatedAt: string;
  user: User;
  totalEarnings?: number; // Optional field for total earnings
}

export interface ExamAssessmentWithRelations extends ExamAssessment {
  training_batches?: {
    tb_id: number;
    tb_name: string;
    tb_slug: string;
    tb_descrip: string;
    tb_start: string;
    tb_end: string;
    tb_status: number;
    createdAt: string;
    updatedAt: string;
  };
  centers?: {
    center_id: number;
    center_name: string;
    center_location: string;
    center_type: string;
    center_medium: string;
    center_status: number;
    createdAt: string;
    updatedAt: string;
  };
  courses?: {
    course_id: number;
    course_name: string;
    course_full_name: string;
    course_status: number;
    createdAt: string;
    updatedAt: string;
  };
  student?: Student;
}

export interface ExamAssessmentFormData {
  std_cnic: string;
  tb_id: number;
  center_id: number;
  course_id: number;
  ea_type: "MID" | "FINAL";
  class_participation: number;
  final_task: number;
  presentation: number;
  viva: number;
  remarks?: string;
  attendanceProgress?: number;
}
