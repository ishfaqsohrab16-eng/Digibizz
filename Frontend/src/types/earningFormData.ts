export interface EarningFormData {
  user_id: number;
  center_id: number;
  course_id: number;
  tb_id: number;
  earning_platform: string;
  earning_amount: number;
  earning_date: string;
}
export interface EarningsData {
  batchDetails: {
    trainingBatchId: string;
    totalEarnings: string;
    studentStatistics: {
      totalStudents: number;
      maleCount: number;
      femaleCount: number;
    };
  };
  centerDetails: {
    centerId: number;
    centerName: string;
  };
  courseDetails: {
    courseId: number;
    courseName: string;
  };
  trainerDetails: {
    trainerId: number;
    trainerName: string;
    trainerImage: string;
  };
  trainingBatchDetails: {
    trainingBatchId: number;
    trainingBatchName: string;
  };
  earnings: Array<{
    earningId: number;
    studentId: number;
    studentName: string;
    studentImage: string;
    platform: string;
    amount: string;
    date: string;
    status: number;
    proof: string;
  }>;
}
export interface EarningsTableRow {
  platform: string;
  amount: string;
  date: string;
  status: string;
  proof: string;
  centerName: string;
  courseName: string;
  trainingBatchName: string;
  studentName: string;
  trainerName: string;
  studentImage: string;
  trainerImage: string;
}
