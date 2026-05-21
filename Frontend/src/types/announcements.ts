export interface AnnouncementFormData {
  ca_title: string;
  ca_message: string;
  t_id?: number;
  tb_id: number;
  user_id: number;
}

export interface AnnouncementFormErrors {
  ca_title?: string;
  ca_message?: string;
}

export interface Announcement {
  ca_id: number;
  ca_title: string;
  ca_message: string;
  t_id: number;
  tb_id: number;
  course_id: number;
  center_id: number;
  ca_added_on: string;
  trainer?: {
    user?: {
      user_name: string;
    };
  };
  course?: {
    course_name: string;
  };
  center?: {
    center_name: string;
  };
  training_batch?: {
    tb_name: string;
  };
}
