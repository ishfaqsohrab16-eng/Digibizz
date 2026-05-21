export interface TopicData {
  title: string;
  content_type: string;
  description: string;
  resource_link?: string;
  order_index?: number;
}

export interface CourseModuleFormData {
  course_id: number;
  title: string;
  order_index?: number;
  created_by?: number;
  module_image?: string;
  topics: TopicData[];
}
