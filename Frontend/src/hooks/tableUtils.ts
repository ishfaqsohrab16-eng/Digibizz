import { StudentData, Column, FilterStatus, FilterBy } from "@/types/columns";

export const sortData = (
  data: any[],
  key: keyof any,
  direction: "asc" | "desc"
) => {
  return [...data].sort((a, b) => {
    if (direction === "asc") {
      return a[key] < b[key] ? -1 : 1;
    }
    return a[key] > b[key] ? -1 : 1;
  });
};
export const filterSearchData = (data: any[], searchTerm: string) => {
  if (!searchTerm) return data;
  return data.filter((item) => {
    return Object.values(item).some((value) =>
      String(value).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });
};
export const filterData = (data: any[], filterStatus: FilterStatus) => {
  switch (filterStatus) {
    case "recommended":
      return data.filter((item) => item.recommended === "Yes");
    case "non-recommended":
      return data.filter((item) => item.recommended === "No");
    default:
      return data;
  }
};
export const DEFAULT_FILTER_BY: FilterBy[] = [
  { id: "all", value: "All Candidates" },
  { id: "recommended", value: "Recommended" },
  { id: "non-recommended", value: "Non Recommended" },
];
export const DEFAULT_FILTER_BY_Student_Status: FilterBy[] = [
  { id: "all", value: "All Students" },
  { id: "active", value: "Active" },
  { id: "inactive", value: "Inactive" },
];
export const DEFAULT_FILTER_BY_TRAINING_BATCH_STATUS: FilterBy[] = [
  { id: "all", value: "All Training Batches" },
  { id: "active", value: "Active" },
  { id: "inactive", value: "Inactive" },
];
export const DEFAULT_FILTER_BY_EARNINGS_STATUS: FilterBy[] = [
  { id: "all", value: "All Earnings" },
  { id: "pending", value: "Pending" },
  { id: "approved", value: "Approved" },
  { id: "not_approved", value: "Not Approved" },
];
export const DEFAULT_FILTER_BY_TICKET_STATUS: FilterBy[] = [
  { id: "1", value: "all" },
  { id: "2", value: "UN-ANSWERED" },
  { id: "3", value: "ANSWERED" },
];
export const DEFAULT_COLUMNS: Column[] = [
  { id: "cand_cnic", label: "CNIC", visible: true },
  { id: "cand_photo", label: "Image", visible: true },

  { id: "cand_name", label: "Name", visible: true },
  { id: "cand_fathername", label: "Father's Name", visible: true },
  { id: "cand_gender", label: "Gender", visible: true },
  { id: "course_id", label: "Course", visible: true },
  { id: "center_id", label: "Center", visible: true },
  { id: "cand_phone", label: "Phone", visible: true },
  { id: "cand_whatsapp", label: "WhatsApp", visible: true },
  { id: "cand_email", label: "Email", visible: true },
  { id: "cand_apply_date", label: "Applied", visible: true },
  { id: "interview_date", label: "Interview Date", visible: true },
  { id: "cand_admission_status", label: "Status", visible: true },
  { id: "recommended", label: "Interview Status", visible: true },
  { id: "cand_local_domicile", label: "Domicile", visible: true },
  { id: "cand_degree_level", label: "Qualification", visible: true },
];

export const DEFAULT_ASSIGNMENT_COLUMNS: Column[] = [
  { id: "as_title", label: "Title", visible: true },
  { id: "as_marks", label: "Marks ", visible: true },
  { id: "as_added_on", label: "Created At", visible: true },
  { id: "as_deadline_formatted", label: "Deadline", visible: true },
  { id: "course_name", label: "Course", visible: true },
  { id: "center_name", label: "Center", visible: true },
  { id: "tb_name", label: "Training Batch", visible: true },
  { id: "t_name", label: "Trainer", visible: true },
];

export const DEFAULT_CENTER_USER_COLUMNS: Column[] = [
  { id: "user_name", label: "Name", visible: true },
  { id: "user_email", label: "Email", visible: true },
  { id: "user_profile_photo", label: "Profile Photo", visible: true },
  { id: "user_type", label: "Type", visible: true },
];

export const DEFAULT_STUDENT_COLUMNS: Column[] = [
  { id: "user_profile_photo", label: "Profile Photo", visible: true },
  { id: "user_name", label: "Name", visible: true },
  { id: "user_email", label: "Email", visible: true },
  { id: "student_cnic", label: "CNIC", visible: true },
  { id: "user_type", label: "Type", visible: true },
  { id: "course_name", label: "Course", visible: true },
  { id: "center_name", label: "Center", visible: true },
  { id: "tb_name", label: "Training Batch", visible: true },
  { id: "user_status", label: "Status", visible: true },
  { id: "std_lms_status", label: "LMS Status", visible: true },
];
export const DEFAULT_TRAINING_BATCH_COLUMNS: Column[] = [
  { id: "tb_name", label: "Name", visible: true },
  { id: "tb_slug", label: "Slug", visible: true },
  { id: "tb_descrip", label: "Description", visible: true },
  { id: "tb_start", label: "Start Date", visible: true },
  { id: "tb_end", label: "End Date", visible: true },
  { id: "tbStatus", label: "Status", visible: true },
];
export const DEFAULT_CENTER_COLUMNS: Column[] = [
  { id: "center_name", label: "Name", visible: true },
  { id: "center_location", label: "Location", visible: true },
  { id: "center_type", label: "Type", visible: true },
  { id: "center_medium", label: "Medium", visible: true },
  { id: "center_status", label: "Status", visible: true },
  { id: "tb_name", label: "Training Batch", visible: true },
  { id: "tb_start", label: "Start Date", visible: true },
  { id: "tb_end", label: "End Date", visible: true },
];
export const DEFAULT_MASTER_TRAINER_COLUMNS: Column[] = [
  { id: "user_name", label: "Name", visible: true },
  { id: "user_email", label: "Email", visible: true },
  { id: "user_profile_photo", label: "Profile Photo", visible: true },
  { id: "user_type", label: "Type", visible: true },
  { id: "user_status", label: "Status", visible: true },
  { id: "course_name", label: "Course", visible: true },
];
export const DEFAULT_TRAINER_COLUMNS: Column[] = [
  { id: "user_name", label: "Name", visible: true },
  { id: "user_email", label: "Email", visible: true },
  { id: "user_profile_photo", label: "Profile Photo", visible: true },
  { id: "user_type", label: "Type", visible: true },
  { id: "user_status", label: "Status", visible: true },
  { id: "course_name", label: "Course", visible: true },
  { id: "center_name", label: "Center", visible: true },
  { id: "tb_name", label: "Training Batch", visible: true },
];
export const DEFUALT_REPORT_COLUMNS: Column[] = [
  { id: "dlr_date", label: "Date", visible: true },
  { id: "dlr_title", label: "Title", visible: true },
  { id: "dlr_topics", label: "Topics", visible: true },
  { id: "dlr_practical", label: "Practical", visible: true },
  { id: "dlr_assignment", label: "Assignment", visible: true },
  { id: "dlr_challenges", label: "Challenges", visible: true },
  { id: "dlr_month", label: "Month", visible: true },
  { id: "t_cnic", label: "CNIC", visible: true },
  { id: "course_name", label: "Course", visible: true },
  { id: "center_name", label: "Center", visible: true },
  { id: "tb_name", label: "Training Batch", visible: true },
];
export const DEFAULT_EARNINGS_COLUMNS: Column[] = [
  { id: "earning_platform", label: "Platform", visible: true },
  { id: "earning_amount", label: "Amount", visible: true },
  { id: "earning_date", label: "Date", visible: true },
  { id: "earning_status", label: "Status", visible: true },
  { id: "earning_proof", label: "File", visible: true },
  { id: "center_name", label: "Center", visible: true },
  { id: "course_name", label: "Course", visible: true },
  { id: "tb_name", label: "Training Batch", visible: true },
  { id: "user_name", label: "User", visible: true },
];
export const DEFAULT_EARNINGS_SUBMISSIONS_COLUMNS: Column[] = [
  { id: "studentImage", label: "File", visible: true },
  { id: "studentName", label: "Student Name", visible: true },
  { id: "platform", label: "Platform", visible: true },
  { id: "amount", label: "Amount", visible: true },
  { id: "date", label: "Date", visible: true },
  { id: "status", label: "Status", visible: true },
  { id: "centerName", label: "Center", visible: true },
  { id: "courseName", label: "Course", visible: true },
];
export const DEFAULT_STUDENT_LEAVE_COLUMNS: Column[] = [
  { id: "sl_code", label: "Code", visible: true },
  { id: "std_cnic", label: "CNIC", visible: true },
  { id: "sl_subject", label: "Subject", visible: true },
  { id: "sl_submit_date", label: "Date", visible: true },
  { id: "sl_status", label: "Status", visible: true },
  { id: "tb_name", label: "Training Batch", visible: true },
  { id: "center_name", label: "Center", visible: true },
  { id: "course_name", label: "Course", visible: true },
];
export const DEFAULT_TRAINER_LEAVE_COLUMNS: Column[] = [
  { id: "tl_code", label: "Code", visible: true },
  { id: "t_name", label: "Trainer Name", visible: true },
  { id: "tl_subject", label: "Subject", visible: true },
  { id: "tl_submit_date", label: "Date", visible: true },
  { id: "tl_status", label: "Status", visible: true },
  { id: "tb_name", label: "Training Batch", visible: true },
  { id: "center_name", label: "Center", visible: true },
  { id: "course_name", label: "Course", visible: true },
];
export const DEFAULT_HOLIDAYS_COLUMNS: Column[] = [
  { id: "h_date", label: "Date", visible: true },
  { id: "h_reason", label: "Reason", visible: true },
  { id: "tb_slug", label: "Training Batch ", visible: true },
];
export const DEFAULT_ACTIVITY_LOG_COLUMNS: Column[] = [
  { id: "user_type", label: "User Type", visible: true },
  { id: "act_on", label: "On", visible: true },
  { id: "course_name", label: "Course ", visible: true },
  { id: "center_name", label: "Center ", visible: true },
  { id: "tb_name", label: "Training Batch ", visible: true },
  { id: "act_type", label: "Activity Type", visible: true },
  { id: "act_descrip", label: "Description", visible: true },
];
export const DEFAULT_ANNOUNCEMENT_COLUMNS: Column[] = [
  { id: "ca_title", label: "Title", visible: true },
  { id: "ca_message", label: "Message", visible: true },
  { id: "ca_added_on", label: "Created At", visible: true },
  { id: "course_name", label: "Course", visible: true },
  { id: "center_name", label: "Center", visible: true },
  { id: "tb_name", label: "Training Batch", visible: true },
  { id: "t_name", label: "Trainer", visible: true },
];
export const DEFAULT_TICKET_COLUMNS: Column[] = [
  { id: "ticket_no", label: "Ticket ID", visible: true },
  { id: "ticket_subject", label: "Subject", visible: true },
  { id: "ticket_date", label: "Date", visible: true },
  { id: "ticket_time", label: "Time", visible: true },
  { id: "ticket_status", label: "Status", visible: true },
  { id: "center_name", label: "Center", visible: true },
  { id: "course_name", label: "Course", visible: true },
  { id: "student_name", label: "Student", visible: true },
];

export const ASSIGNMENT_SUBMISSION_COLUMNS: Column[] = [
  { id: "std_rollno", label: "Roll No", visible: true },
  { id: "std_name", label: "Student Name", visible: true },
  { id: "center_name", label: "Center", visible: true },
  { id: "course_name", label: "Course", visible: true },
  { id: "submission_date", label: "Submitted On", visible: true },
  { id: "assignment_title", label: "Assignment", visible: true },
  { id: "total_marks", label: "Total Marks", visible: true },
  { id: "obtained_marks", label: "Obtained Marks", visible: true },
  { id: "status", label: "Status", visible: true },
];

export const DEFAULT_EXAM_ASSESSMENT_COLUMNS: Column[] = [
  { id: "std_cnic", label: "Student CNIC", visible: true },
  { id: "ea_type", label: "Exam Type", visible: true },
  { id: "class_participation", label: "Class Participation", visible: true },
  { id: "final_task", label: "Final Task", visible: true },
  { id: "presentation", label: "Presentation", visible: true },
  { id: "viva", label: "Viva", visible: true },
  { id: "status", label: "Status", visible: true },
  { id: "total_score", label: "Total Score", visible: true },
  { id: "center_name", label: "Center", visible: true },
  { id: "course_name", label: "Course", visible: true },
  { id: "batch_name", label: "Batch", visible: true },
  { id: "remarks", label: "Remarks", visible: false },
];

export const DEFAULT_FILTER_BY_EXAM_TYPE: FilterBy[] = [
  { id: "all", value: "all" },
  { id: "MID", value: "MID" },
  { id: "FINAL", value: "FINAL" },
];
