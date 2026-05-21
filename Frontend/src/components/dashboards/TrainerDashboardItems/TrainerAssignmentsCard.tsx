import React from "react";
import { FileText, Calendar } from "lucide-react";
import AssignmentView from "../../Assignment/AssignmentView";
import { useBatch } from "../../../context/BatchContext";

interface Assignment {
  as_title: string;
  as_deadline: string;
  as_added_on?: string;
}
interface AdminDashboardProps {
  openForm: (formName: string) => void;
}
interface TrainerAssignmentsCardProps {
  assignments: Assignment[];
  openForm?: (formName: string, assignment?: Assignment) => void; // updated signature
}

import { useLocation } from "react-router-dom";

const TrainerAssignmentsCard: React.FC<TrainerAssignmentsCardProps> = ({
  assignments,
  openForm,
}) => {
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);
  const subuser = queryParams.get("subuser");

  return (
    <div className="bg-card rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">
          Recent Assignments
        </h3>
        <button
          onClick={() => openForm && openForm("AssignmentList")}
          className="text-sm text-primary hover:text-primary/80"
        >
          View All
        </button>
      </div>
      <div className="space-y-4">
        {assignments.map((assignment, index) => {
          const assignmentUrl = new URLSearchParams({
            subuser: subuser ?? "",
            t: Date.now().toString(), // You can add any time param if needed
          });

          const fullHref = `/dashboard/AssignmentView?${assignmentUrl.toString()}`;

          return (
            <a
              key={index}
              href={fullHref}
              onClick={(e) => {
                e.preventDefault();
                localStorage.setItem("assignmentDetails", JSON.stringify(assignment));
                openForm && openForm("AssignmentList");
              }}
              className="block w-full text-left border-b border-border pb-4 last:border-b-0 last:pb-0 hover:bg-muted/50 rounded transition"
            >
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-foreground">
                    {assignment.as_title}
                  </h4>
                  <div className="mt-1 flex items-center text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 mr-1" />
                    <span>
                      Due {new Date(assignment.as_deadline).toLocaleDateString()}
                    </span>
                  </div>
                  {assignment.as_added_on && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Created: {new Date(assignment.as_added_on).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
};
export default TrainerAssignmentsCard;