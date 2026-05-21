export interface TrainerAttendanceInput {
  cu_id: number;
  t_id: number;
  tb_id: number;
  center_id: number;
  ta_date: Date;
  checkin_time?: string;
  checkout_time?: string;
}

export interface TrainerAttendanceResponse {
  success: boolean;
  data: {
    id: number;
    cu_id: number;
    t_id: number;
    tb_id: number;
    center_id: number;
    ta_date: Date;
    checkin_time: string | null;
    checkout_time: string | null;
    created_at: Date;
    updated_at: Date;
  };
}
