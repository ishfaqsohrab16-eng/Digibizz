export interface StudentLeaveFormData {
  sl_code: string;
  std_cnic: string;
  course_id: number;
  center_id: number;
  tb_id: number;
  sl_date: string;
  sl_month: string;
  sl_subject: string;
  sl_body: string;
  sl_trainer_comments: string;
  sl_status: number;
  sl_submit_date: string;
}
export interface StudentLeaveFormDataToView {
  sl_code: string;
  std_cnic: string;
  course_name: string;
  center_name: string;
  tb_name: string;
  sl_subject: string;
  sl_body: string;
  sl_trainer_comments: string;
  sl_status: string;
  sl_submit_date: string;
  sl_date: string;
  sl_month: string;
}
export interface TrainerLeaveFormDataToView {
  t_id: number;
  tl_code: string;
  t_name: string;
  course_name: string;
  center_name: string;
  tb_name: string;
  tl_subject: string;
  tl_body: string;
  tl_mt_comments: string;
  tl_admin_comments: string;
  tl_status: string;
  tl_submit_date: string;
  tl_date: string;
  tl_month: string;
}
export interface TrainersLeaveFormData {
  tl_code: string;
  tl_subject: string;
  tl_body: string;
  tl_status: number;
  tl_submit_date: string;
  course_id: number;
  center_id: number;
  tb_id: number;
  t_id: number;
  tl_date: string;
  tl_month: string;
  tl_mt_comments: string;
  tl_admin_comments: string;
}
export interface TrainersLeaveFormErrors {
  tl_code?: string;
  tl_subject?: string;
  tl_body?: string;
  tl_status?: string;
  tl_submit_date?: string;
  course_id?: string;
  center_id?: string;
  tb_id?: string;
  t_id?: string;
  tl_date?: string;
  tl_month?: string;
  tl_mt_comments?: string;
}
export interface StudentLeaveFormErrors {
  sl_code?: string;

  std_cnic?: string;
  course_id?: string;
  center_id?: string;
  tb_id?: string;

  sl_date?: string;
  sl_month?: string;
  sl_subject?: string;
  sl_body?: string;
  sl_trainer_comments?: string;
  sl_status?: string;
  sl_submit_date?: string;
}
