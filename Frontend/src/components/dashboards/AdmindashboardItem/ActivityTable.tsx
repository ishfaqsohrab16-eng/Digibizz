import React from "react";
import { Link } from "react-router-dom";

interface ActivityLogEntry {
  timestamp: string;
  user: string;
  userType: string;
  actType: string;
  description: string;
}

interface ActivityTableProps {
  entries: ActivityLogEntry[];
  showViewAllButton?: boolean;
}

const ActivityTable: React.FC<ActivityTableProps> = ({
  entries,
  showViewAllButton = true,
}) => {
  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-semibold mb-4">Activity Log</h2>
      <div className="overflow-hidden rounded-md border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Timestamp
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                User
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                User Type
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Act Type
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Description
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {entries.map((entry, index) => (
              <tr
                key={index}
                className="transition-all duration-300 hover:bg-dashboard-lightGray group"
                style={{
                  opacity: 0,
                  animation: "fade-in 0.3s ease-out forwards",
                  animationDelay: `${index * 50}ms`,
                }}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 group-hover:text-primary">
                  {entry.timestamp}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700 group-hover:text-primary">
                  {entry.user}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 group-hover:text-primary">
                  {entry.userType}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 group-hover:text-primary">
                  {entry.actType}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 group-hover:text-primary">
                  {entry.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {showViewAllButton && (
          <div className="flex items-center justify-center py-4 bg-dashboard-navy">
            <Link
              to="/activity-log"
              className="text-white font-medium text-sm hover:underline transition-all"
            >
              View All Activity Log
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityTable;
