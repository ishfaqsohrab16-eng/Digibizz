import { useState } from "react";
import { Star } from "lucide-react";
import { NavItem } from "../NavItem";
import { SubNavItem } from "../SubNavItem";

interface AdminNavProps {
  openForm: (formName: string) => void;
}

export const AdminNav = ({ openForm }: AdminNavProps) => {
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  return (
    <div className="relative">
      <NavItem
        icon={<Star size={20} />}
        label="Back End Admin"
        hasSubmenu
        isOpen={isAdminOpen}
        onClick={() => setIsAdminOpen(!isAdminOpen)}
      />
      {isAdminOpen && (
        <div className="mt-1 space-y-1">
          <SubNavItem
            label="Create Admin"
            isParentOpen={isAdminOpen}
            onClick={() => openForm("CreateAdmin")}
          />
          <SubNavItem
            label="Enrolled Admin"
            isParentOpen={isAdminOpen}
            onClick={() => openForm("EnrolledAdmin")}
          />
        </div>
      )}
    </div>
  );
};
