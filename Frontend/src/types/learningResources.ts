export interface LearningResourceData {
  ls_id?: number;
  ls_title: string;
  ls_description: string;
  ls_attachment?: string;
  t_id: number;
  course_id: number;
  center_id: number;
  tb_id: number;
  ls_added_on?: string;
}

export interface LectureRecordingData {
  lr_id?: number;
  lr_title: string;
  lr_topics: string;
  lr_link: string;
  lr_attachment?: string;
  lr_date: string;
  t_id: number;
  tb_id: number;
  course_id: number;
  center_id: number;
  lr_added_on?: string;
}
