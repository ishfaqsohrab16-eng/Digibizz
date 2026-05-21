import React from "react";
import { Clock, Users, CalendarX } from "lucide-react";

interface TrainerStatsTableProps {
  students: {
    active: number;
    total: number;
  };
  missingAttendance: {
    count: number;
    dates: string[];
    lastUpdated: string;
  };
  pendingLeaves: {
    count: number;
    lastUpdated: string;
  };
  openForm: (formName: string) => void;
}

const TrainerStatsTable: React.FC<TrainerStatsTableProps> = ({
  students,
  missingAttendance,
  pendingLeaves,
  openForm
}) => {
  return (
    <div className="rounded-lg bg-card shadow-md p-4">
      <h3 className="text-lg font-medium text-foreground mb-4">Trainer Stats</h3>

      <div className="space-y-4">
        {/* Students Stats */}
        <div className="border-b border-border pb-3">
          <div className="flex items-center mb-2">
            <Users className="h-5 w-5 text-muted-foreground mr-2" />
            <span className="font-medium text-foreground">Students</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Active Students:</span>
            <span 
              className="text-sm font-medium text-primary cursor-pointer hover:text-primary/80 hover:underline transition-colors"
              onClick={() => openForm("StudentTable")}
              title="View active students"
            >
              {students.active}
            </span>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-sm text-muted-foreground">Total Students:</span>
            <span 
              className="text-sm font-medium text-primary cursor-pointer hover:text-primary/80 hover:underline transition-colors"
              onClick={() => openForm("StudentTable")}
              title="View all students"
            >
              {students.total}
            </span>
          </div>
        </div>

        {/* Missing Attendance Stats */}
        <div className="border-b border-border pb-3">
          <div className="flex items-center mb-2">
            <CalendarX className="h-5 w-5 text-muted-foreground mr-2" />
            <span className="font-medium text-foreground">Missing Attendance</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-muted-foreground">Days Missing:</span>
            <span 
              className="text-sm font-medium text-primary cursor-pointer hover:text-primary/80 hover:underline transition-colors"
              onClick={() => openForm("TakeAttendance")}
              title="View missing attendance days"
            >
              {missingAttendance.count}
            </span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            <div>Missing dates:</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {missingAttendance.dates.map((date, i) => (
                <span 
                  key={i} 
                  className="bg-primary/10 text-primary px-2 py-1 rounded cursor-pointer hover:bg-primary/20 transition-colors duration-200 border border-primary/20"
                  onClick={() => openForm("TakeAttendance")}
                  title="Click to mark attendance for this date"
                >
                  {new Date(date).toLocaleDateString()}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Last updated: {new Date(missingAttendance.lastUpdated).toLocaleString()}
          </div>
        </div>

        {/* Pending Leaves Stats */}
        <div className="pb-3">
          <div className="flex items-center mb-2">
            <Clock className="h-5 w-5 text-muted-foreground mr-2" />
            <span className="font-medium text-foreground">Pending Leaves</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-muted-foreground">Leaves to Approve:</span>
            <span 
              className="text-sm font-medium text-primary cursor-pointer hover:text-primary/80 hover:underline transition-colors"
              onClick={() => openForm("StudentLeave")}
              title="View and approve pending leave requests"
            >
              {pendingLeaves.count}
            </span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Last updated: {new Date(pendingLeaves.lastUpdated).toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrainerStatsTable;
