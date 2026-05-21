export interface CandidateFormData {
  cand_id: number; // Primary Key
  cand_cnic: string;
  cand_name: string;
  cand_fathername: string;
  tb_id: number;
  course_id: number;
  center_id: number;
  cand_email: string;
  confirm_email: string; // For validation only
  cand_phone: string;
  confirm_phone: string; // For validation only
  cand_whatsapp: string;
  guardian_whatsapp: string;
  cand_gender: string;
  cand_dob: string;
  cand_local_domicile: string;
  cand_degree_level: string;
  degree_area: string;
  institute: string;
  degree_start_date: string;
  degree_end_date: string;
  current_address: string;
  permanent_address: string;
  current_city: string;
  permanent_city: string;
  cand_test_code: string;
  cand_test_marks: number;
  cand_interview_marks: string;
  cand_admission_status: number;
  cand_apply_date: string;
  reject_reason: string;
  laptop_pc: string;
  recommended: string;

  course_second_priority: number;
  center_second_priority: number;
  interview_date: string;
  where_find_us: string; // Additional field for validation
}
export interface UpdateCandidateTestScoreType {
  cand_id: number;
  cand_test_code: string;
  cand_test_marks: string;
}
