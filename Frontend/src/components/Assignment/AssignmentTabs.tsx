import React, { useState } from "react";
import AssignmentView from "./AssignmentView";
import { AssignmentSubmissionList } from "./AssignmentSubmissionList";
import AssignmentUpdate from "./AssignmentUpdate";

// Define the props for the AssignmentTabs component
interface AssignmentTabsProps {
  viewData: any;
  userType: string;
  userId: number;
}

const AssignmentTabs: React.FC<AssignmentTabsProps> = ({ 
  viewData, 
  userType, 
  userId 
}) => {
  const [activeTab, setActiveTab] = useState<string>("AssignmentView");

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab("AssignmentView")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "AssignmentView"
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Assignment Details
          </button>
          {userType !== "student" && (
            <>
              <button
                onClick={() => setActiveTab("SubmissionList")}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "SubmissionList"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Submissions
              </button>
              {activeTab === "AssignmentUpdate" && (
                <button
                  onClick={() => setActiveTab("AssignmentUpdate")}
                  className={`py-4 px-1 border-b-2 font-medium text-sm border-primary text-primary`}
                >
                  Update Submission
                </button>
              )}
            </>
          )}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === "AssignmentView" && (
          <AssignmentView
            assignment={viewData}
            userType={userType}
            userId={userId}
            setActiveTab={setActiveTab}
          />
        )}
        {activeTab === "AssignmentUpdate" && userType !== "student" && (
          <AssignmentUpdate
            assignment={viewData}
            setActiveTab={setActiveTab}
          />
        )}
      </div>
    </div>
  );
};

export default AssignmentTabs;