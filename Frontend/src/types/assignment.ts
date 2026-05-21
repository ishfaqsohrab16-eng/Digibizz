export interface AssignmentFormData {
  tb_id: number;
  user_id: number;
  as_title: string;
  as_description: string;
  as_marks: string;
  as_deadline: string;
  attachment: File | null;
  as_status: number;
}
export interface AssignmentFormErrors {
  course_id?: string;
  center_id?: string;
  tb_id?: string;
  as_title?: string;
  as_description?: string;
  as_marks?: string;
  as_deadline?: string;
  attachment?: string;
  as_status?: string;
}
