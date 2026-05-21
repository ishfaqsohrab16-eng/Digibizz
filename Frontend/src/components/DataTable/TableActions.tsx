import React from "react";
import { Eye, Edit2, Mail } from "lucide-react";

interface TableActionsProps {
  onEdit?: () => void;
  onView?: () => void;
  email?: string;
}

export const TableActions: React.FC<TableActionsProps> = ({
  onEdit,
  onView,
  email,
}) => {
  const handleSendEmail = (email: string) => {
    window.location.href = `mailto:${email}`;
  };

  return (
    <div className="flex space-x-2">
      {onEdit && (
        <button
          className="p-1 bg-green-500 text-white rounded hover:bg-green-600"
          onClick={onEdit}
        >
          <Edit2 size={16} />
        </button>
      )}
      {onView && (
        <button
          className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={onView}
        >
          <Eye size={16} />
        </button>
      )}
      {email && (
        <button
          className="p-1 bg-purple-500 text-white rounded hover:bg-purple-600"
          onClick={() => handleSendEmail(email)}
        >
          <Mail size={16} />
        </button>
      )}
    </div>
  );
};
