import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar } from "@fortawesome/free-solid-svg-icons";
import { NavItem } from "../NavItem";
import { SubNavItem } from "../SubNavItem";

interface CenterNavProps {
  openForm: (formName: string) => void;
  activeSubmenu: string | null;
  onSubmenuClick: (menuName: string) => void;
  createNavUrl: (path: string) => string;
}

export const CenterNav = ({
  openForm,
  activeSubmenu,
  onSubmenuClick,
  createNavUrl,
}: CenterNavProps) => {
  const [isCenterOpen, setIsCenterOpen] = useState(false);
  const isCenterSubmenuOpen = activeSubmenu === "Center";
  // Define submenu items with hrefs
  const subNavItems = [
    { label: "Create Center", formName: "Center" },
    { label: "Enrolled Center", formName: "CenterEnrolled" },
    { label: "Center Date", formName: "CenterDates" },
    { label: "Center User", formName: "CenterUsers" },
  ];
  return (
    <div className="relative">
      <NavItem
        icon={<FontAwesomeIcon icon={faStar} />}
        label="Center"
        hasSubmenu
        isOpen={isCenterSubmenuOpen}
        onClick={() => {
          onSubmenuClick("Center");
        }}
      />
      {isCenterSubmenuOpen && (
        <div className="mt-1 space-y-1 flex flex-col">
          {subNavItems.map((item) => (
            <SubNavItem
              key={item.label}
              label={item.label}
              isParentOpen={isCenterOpen}
              href={createNavUrl(`/dashboard/${item.formName}`)}
              onClick={() => openForm(item.formName)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
