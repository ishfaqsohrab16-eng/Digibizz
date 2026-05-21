import React, { useState, useEffect } from "react";

import SuspensionForm from "./SuspensionForm";
import UnSuspensionForm from "./UnSuspensionForm";
import SettingsHeader from "../../Settings/SettingsHeader";

interface getHolidaysData {
  h_date: string;
  h_reason: string;
  tb_slug: string;
}
const Suspend = () => {
  const [activeTab, setActiveTab] = useState("SuspensionForm");
  return (
    <div className="p-5 max-w-8xl mx-auto">
      <SettingsHeader
        SettingsHeader="Suspend a Student"
        SettingDescription="Here you can suspend any student. They will not able to use LMS anymore. And all Announcement and Assignments emails will be suspended to them as well."
      />
      <nav className="bg-white shadow-md">
        <div className="container mx-auto px-4">
          <div className="flex items-center space-x-4 h-14">
            {/* Summary Dropdown */}
            <button
              onClick={() => setActiveTab("SuspensionForm")}
              className="px-3 py-2 rounded-md hover:bg-gray-100"
            >
              Suspension
            </button>

            {/* Interview Panel */}
            <button
              onClick={() => setActiveTab("UnSuspensionForm")}
              className="px-3 py-2 rounded-md hover:bg-gray-100"
            >
              UnSuspension
            </button>
          </div>
        </div>
      </nav>
      <div className="mt-10">
        {activeTab === "SuspensionForm" && <SuspensionForm />}
        {activeTab === "UnSuspensionForm" && <UnSuspensionForm />}
      </div>
    </div>
  );
};

export default Suspend;
