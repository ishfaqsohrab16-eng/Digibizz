import React, { useContext } from "react";
import { SidebarContext } from "./Sidebar";

interface SubNavItemProps {
  label: string;
  onClick?: () => void;
  isParentOpen: boolean;
  href?: string; // Add href prop
}

export const SubNavItem: React.FC<SubNavItemProps> = ({
  label,
  onClick,
  isParentOpen,
  href, // Destructure href
}) => {
  const { isExpanded } = useContext(SidebarContext);

  // Hide submenu items if sidebar is collapsed
  if (!isExpanded) {
    return null;
  }

  return (
    <a
      href={href}
      className="w-full pl-10 pr-3 py-2 text-left text-sm sidebar-menu-item sidebar-hover-effect rounded-md appearance-none outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={(e) => {
        if (onClick) {
          e.preventDefault(); // Prevent default navigation if using SPA
          onClick();
        }
      }}
    >
      {label}
    </a>
  );
};
