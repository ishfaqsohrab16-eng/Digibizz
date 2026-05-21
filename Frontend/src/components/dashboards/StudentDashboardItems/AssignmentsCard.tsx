import React from "react";

interface Assignment {
  title: string;
  points: number;
  deadline: string;
}

interface AssignmentsCardProps {
  assignments: Assignment[];
}

const AssignmentsCard: React.FC<AssignmentsCardProps> = ({ assignments = [] }) => {
  return (
    <div className="bg-card rounded-lg shadow-sm p-6 animate-fade-up">
      <h2 className="text-lg font-semibold mb-4 text-foreground">My Recent Assignments</h2>

      {assignments && assignments.length > 0 ? (
        assignments.map((assignment, index) => (
          <div key={index} className="mb-4 last:mb-0">
            <h3 className="text-md font-medium text-foreground">{assignment.title}</h3>
            <div className="flex justify-between mt-1">
              <div className="flex items-center">
                <span className="bg-primary text-primary-foreground text-xs rounded px-2 py-1">
                  Points: {assignment.points}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                <span className="bg-muted px-2 py-1 rounded">
                  Deadline: {assignment.deadline}
                </span>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="text-muted-foreground text-center py-4">
          No assignments available.
        </div>
      )}
    </div>
  );
};

export default AssignmentsCard;
