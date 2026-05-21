interface StatisticsPanelProps {
  student: string;
  rollNo: string;
  submittedOn?: string;
  deadline: string;
  totalPoints: number;
  obtainedPoints: string;
}

const StatisticsPanel = ({
  student,
  rollNo,
  submittedOn,
  deadline,
  totalPoints,
  obtainedPoints,
}: StatisticsPanelProps) => {
  return (
    <div className="bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] p-6 rounded-lg">
      <h2 className="text-2xl font-bold mb-6">Statistics</h2>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span>Student</span>
          <span>{student}</span>
        </div>
        <div className="flex justify-between items-center">
          <span>Roll No.</span>
          <span>{rollNo}</span>
        </div>
        <div className="flex justify-between items-center">
          <span>Submitted On</span>
          <span>{submittedOn || "Not submitted yet"}</span>
        </div>
        <div className="flex justify-between items-center">
          <span>Deadline</span>
          <span>{deadline}</span>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-6">Grading</h2>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span>Total Points</span>
            <span>{totalPoints}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Obtained Points</span>
            <span>{obtainedPoints}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatisticsPanel;
