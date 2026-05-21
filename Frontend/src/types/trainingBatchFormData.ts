export interface TrainingBatchFormData {
  tb_name: string;
  tb_slug: string;
  tb_descrip: string;
  tb_start: string;
  tb_end: string;
  tb_status: "0" | "1";
}

export interface ApiError {
  message: string;
  errors?: Array<{ msg: string }>;
}
export interface TrainingBatchTableData {
  id: number; // Add this field
  tb_id: number;
  tb_name: string;
  tb_slug: string;
  tb_descrip: string;
  tb_start: string;
  tb_end: string;
  tb_status: "0" | "1";
  tbStatus: string;
}
