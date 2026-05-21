import { useState, ReactNode } from "react";
import { NavItem } from "../NavItem";
import { SubNavItem } from "../SubNavItem";
import { LucideIcon } from "lucide-react";

interface MenuItem {
  label: string;
  onClick?: () => void;
  formName?: string;
}

interface SubmenuGroupProps {
  icon: ReactNode;
  label: string;
  items: MenuItem[];
  openForm: (formName: string) => void;
}

export const SubmenuGroup = ({
  icon,
  label,
  items,
  openForm,
}: SubmenuGroupProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <NavItem
        icon={icon}
        label={label}
        hasSubmenu
        isOpen={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      />
      {isOpen && (
        <div className="mt-1 space-y-1">
          {items.map((item, index) => (
            <SubNavItem
              key={index}
              label={item.label}
              isParentOpen={isOpen}
              onClick={() => {
                openForm(item.formName);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
