export interface TrainerFormData {
  t_cnic: string;
  user_name: string;
  user_email: string;
  user_password: string;
  user_username: string;
  t_course_id: number;
  t_center_id: number;
  mt_id: number;
  dark_mode: string;
  user_status: number;
  user_type: string; // Added missing field
}
export interface TrainerCenterAllocationFormData {
  t_course_id: number;
  t_center_id: number;
  tb_id: number;
  t_id: number;
  mt_id: number;
}
export interface TrainerApiData {
  user_id: number;
  t_id: number;
  t_name: string;
  t_cnic: string;
  user_name: string;
  user_email: string;
  user_password: string;
  user_username: string;
  t_course_id: number;
  t_center_id: number;
  mt_id: number;
  dark_mode: string;
  user_status: number;
  user_type: string; // Added missing field
}
export interface TrainerListData {
  user_id: number;
  user_name: string;
  user_username: string;
  user_email: string;
  user_type: string;
  user_status: string;
  user_profile_photo: string | null;
  t_id: number;
  t_cnic: string;
  t_added_on: string;
}
export interface Course {
  course_id: number;
  course_name: string;
}
export interface Center {
  center_id: number;
  center_name: string;
}
export interface MasterTrainerApiData {
  user_id: number;
  user_name: string;
  user_username: string;
  user_email: string;
  user_status: number;
  user_profile_photo: string | null;
  courseId: number;
  course_name: string;
  mt_added_on: string;
  mt_id: number;
}

export interface MasterTrainerTableData extends MasterTrainerApiData {
  id: number;
}
export interface CenterWithDates {
  id: number;
  center_id: number;
  center_name: string;
  center_location: string;
  center_type: string;
  center_medium: string;
  center_status: string;
  tb_name: string; // Add this field
  tb_start: Date;
  tb_end: Date;
}
