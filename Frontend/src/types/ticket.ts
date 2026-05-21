export interface Ticket {
  ticket_id: number;
  ticket_no: string;
  std_rollno: string;
  user_name?: string;
  ticket_subject: string;
  ticket_description: string;
  ticket_attachment?: string;
  tb_id: number;
  t_id: number;
  center_id: number;
  course_id: number;
  ticket_to: string;
  ticket_date: string;
  ticket_time: string;
  ticket_status: string;
  
  // Relation fields
  student?: {
    std_rollno: string;
    user_id: number;
    user_name: string;
  };
  trainers?: {
    t_id: number;
    user_id: number;
    t_cnic:string;
    trainer_name: string;
  };
  training_batches?: {
    tb_id: number;
    tb_name: string;
  };
  centers?: {
    center_id: number;
    center_name: string;
  };
  courses?: {
    course_id: number;
    course_name: string;
  };
  replies?: TicketReply[] | TicketReply;
}

export interface TicketReply {
  treply_id: number;
  ticket_no: string;
  reply_by: string;
  reply_message: string;
  reply_attachment?: string;
  reply_date: string;
  reply_time: string;
}
export interface TicketReplyFormData {
  ticket_no: string;
  reply_by: string;
  reply_message: string;
  reply_attachment?: File;
  reply_date?: string;
  reply_time?: string;
  ticket_status?: string;
}

export interface TicketFormData {
  // Required fields
  ticket_subject: string;
  ticket_description: string;
  ticket_to: string;
  t_id: number;
  tb_id: number;
  center_id: number;
  course_id: number;
  std_rollno: string;
  ticket_attachment?: File;
  ticket_no?: string;      
  ticket_date?: string;    
  ticket_time?: string;    
  ticket_status?: string;  
  user_id?: number;      
}

export interface TicketReplyFormData {
  ticket_no: string;
  reply_by: string;
  reply_message: string;
  reply_attachment?: File;
  ticket_status?: string;
}
