import React, { useContext } from "react";
import { ChevronRight } from "lucide-react";
import { SidebarContext } from "./Sidebar";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  hasSubmenu?: boolean;
  isOpen?: boolean;
  isPermanentBorder?: boolean;
  href?: string; 
}

export const NavItem: React.FC<NavItemProps> = ({
  icon,
  label,
  onClick,
  hasSubmenu = false,
  isOpen = false,
  isPermanentBorder = false,
  href, // Destructure href
}) => {
  const { isExpanded, isMobile } = useContext(SidebarContext);

  // Determine border styles
  const borderClass = isPermanentBorder || isOpen
    ? "border-l-4 border-blue-500"
    : "";

  const content = (
    <>
      <div className="flex items-center">
        <div className="flex-shrink-0 sidebar-menu-item w-5 h-5 flex items-center justify-center">
          {icon}
        </div>
        {(isExpanded || isMobile) && (
          <span className="ml-3 text-sm sidebar-menu-item font-medium transition-opacity duration-200">
            {label}
          </span>
        )}
      </div>
      {/* Chevron for dropdown - only show when expanded */}
      {hasSubmenu && isExpanded && (
        <ChevronRight
          size={16}
          className={`transition-transform duration-200 ${isOpen ? "transform rotate-90" : ""}`}
        />
      )}
    </>
  );

  
    return (
      <a
        href={href}
        className={`flex items-center w-full px-3 py-2 text-left sidebar-menu-item rounded-md sidebar-hover-effect ${borderClass}`}
        style={{ justifyContent: isExpanded ? 'space-between' : 'center' }}
        tabIndex={0}
        onClick={(e) => {
        if (onClick) {
          e.preventDefault(); // Prevent default navigation if using SPA
          onClick();
        }
      }}
      >
        {content}
      </a>
    )
  }

  
