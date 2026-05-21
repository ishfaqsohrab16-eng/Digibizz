export interface StudentData {
  cand_id: number;
  cand_cnic: string;
  cand_photo: string;
  cand_name: string;
  cand_fathername: string;
  cand_gender: string;
  course_id: number;
  center_id: number;
  cand_phone: string;
  cand_whatsapp: string;
  cand_email: string;
  cand_apply_date: string;
  interview_date: string;
  cand_admission_status: number;
  recommended: string;
  cand_local_domicile: string;
  cand_degree_level: string;
}

export interface Column {
  id: string;
  label: string;
  visible: boolean;
}

export interface FilterBy {
  id: string;
  value: string;
}

export type FilterStatus = "all" | "OPEN" | "ANSWERED";
export type AssignmentStatus = "all" | "pending" | "completed";
export type StudentStatus = "all" | "active" | "inactive";

export interface AssignmentData {
  assignment_id: number;
  as_title: string;
  as_description: string;
  as_marks: number;
  as_deadline: string;
  as_status: number;
  as_attachment: string;
  center_name: string;
  course_name: string;
  tb_name: string;
}
