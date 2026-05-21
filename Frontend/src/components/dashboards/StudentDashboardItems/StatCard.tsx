import React from "react";
import { cn } from "../../../lib/utils";

interface StatCardProps {
  icon: React.ReactNode;
  iconBgColor: string;
  title: string;
  titleColor: string;
  value: string | number;
  valueColor: string;
  description: string;
  descriptionIcon?: React.ReactNode;
  bgColor?: string;
  onClick?: () => void; // Add onClick prop
}

const StatCard: React.FC<StatCardProps> = ({
  icon,
  iconBgColor,
  title,
  titleColor,
  value,
  valueColor,
  description,
  descriptionIcon,
  bgColor,
  onClick,
}) => {
  // Map theme color classes
  const getBgColorClass = (color: string) => {
    switch (color) {
      case "bg-teal-light": return "bg-teal-light";
      case "bg-pink-light": return "bg-pink-light";
      case "bg-navy-light": return "bg-navy-light";
      default: return "bg-card";
    }
  };

  const getTextColorClass = (color: string) => {
    switch (color) {
      case "text-teal": return "text-primary";
      case "text-pink": return "text-[#FF8B9A]";
      case "text-white": return "text-primary-foreground";
      default: return "text-foreground";
    }
  };

  const getIconBgClass = (color: string) => {
    switch (color) {
      case "bg-teal": return "bg-primary";
      case "bg-pink": return "bg-[#FF8B9A]";
      case "bg-navy": return "bg-secondary";
      default: return "bg-primary";
    }
  };

  return (
    <div 
      className={cn(
        "stat-card rounded-lg shadow-sm animate-fade-up transition-all duration-200", 
        getBgColorClass(bgColor || ""),
        onClick && "hover:shadow-lg cursor-pointer transform hover:-translate-y-1"
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      <div className="flex items-start p-4 pb-0">
        <div className={cn("stat-card-icon mr-3 rounded-full p-2 text-primary-foreground", getIconBgClass(iconBgColor))}>
          {icon}
        </div>
        <div className="flex-1">
          <h3 className={cn("text-sm font-medium", getTextColorClass(titleColor))}>{title}</h3>
          <p className={cn("text-2xl font-semibold mt-1", getTextColorClass(valueColor))}>
            {value}
          </p>
        </div>
      </div>
      <div className="px-4 py-3 border-t border-border mt-2 flex items-center">
        <span className="text-xs text-muted-foreground flex items-center">
          {descriptionIcon}
          <span className="ml-1">{description}</span>
        </span>
      </div>
    </div>
  );
};

export default StatCard;
