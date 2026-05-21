import React from 'react';

interface TrainerStatisticsPanelProps {
  points: number | string;
  submissions: string;
  deadline: string;
  pendingSubmissions: string;
  obtainedPoints: string;
  totalStudents?: string; // Added totalStudents prop as optional
}

const TrainerStatisticsPanel: React.FC<TrainerStatisticsPanelProps> = ({
  points,
  submissions,
  deadline,
  pendingSubmissions,
  obtainedPoints,
  totalStudents = "0" // Default value if not provided
}) => {
  return (
    <div className="bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">Assignment Statistics</h3>
      <div className="space-y-4">
        <div className="flex justify-between">
          <span>Total Points</span>
          <span className="font-medium">{points}</span>
        </div>
        <div className="flex justify-between">
          <span>Submissions</span>
          <span className="font-medium">{submissions} of {totalStudents}</span>
        </div>
        <div className="flex justify-between">
          <span>Deadline</span>
          <span className="font-medium">{deadline}</span>
        </div>
        <div className="flex justify-between">
          <span>Pending Submissions</span>
          <span className="font-medium">{pendingSubmissions}</span>
        </div>
        <div className="flex justify-between">
          <span>Average Points</span>
          <span className="font-medium">{obtainedPoints}</span>
        </div>
      </div>
    </div>
  );
};

export default TrainerStatisticsPanel;
