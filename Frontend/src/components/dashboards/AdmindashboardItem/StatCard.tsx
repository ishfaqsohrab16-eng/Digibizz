import React from "react";

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  themeColor: "teal" | "pink" | "navy" | "primary" | "accent" | "destructive" | string;
  onClick?: () => void;
  color?: string; // Keep for backward compatibility
}

const getColorClasses = (themeColor: string) => {
  switch (themeColor) {
    case "teal":
      return {
        bg: "bg-[hsl(var(--teal-light))]",
        text: "text-[hsl(var(--teal))]",
        hover: "hover:bg-[hsl(var(--teal-light))] hover:shadow-md"
      };
    case "pink":
      return {
        bg: "bg-[hsl(var(--pink-light))]",
        text: "text-[hsl(var(--pink))]",
        hover: "hover:bg-[hsl(var(--pink-light))] hover:shadow-md"
      };
    case "navy":
      return {
        bg: "bg-[hsl(var(--navy-light))]",
        text: "text-[hsl(var(--navy))]",
        hover: "hover:bg-[hsl(var(--navy-light))] hover:shadow-md"
      };
    case "accent":
      return {
        bg: "bg-[hsl(var(--accent))/0.15]",
        text: "text-[hsl(var(--accent))]",
        hover: "hover:bg-[hsl(var(--accent))/0.25] hover:shadow-md"
      };
    case "destructive":
      return {
        bg: "bg-[hsl(var(--destructive))/0.15]",
        text: "text-[hsl(var(--destructive))]",
        hover: "hover:bg-[hsl(var(--destructive))/0.25] hover:shadow-md"
      };
    case "primary":
    default:
      return {
        bg: "bg-[hsl(var(--primary))/0.15]",
        text: "text-[hsl(var(--primary))]",
        hover: "hover:bg-[hsl(var(--primary))/0.25] hover:shadow-md"
      };
  }
};

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  themeColor = "primary",
  onClick,
}) => {
  const colorClasses = getColorClasses(themeColor);
  
  return (
    <div 
      onClick={onClick}
      className={`p-6 rounded-xl ${colorClasses.bg} ${colorClasses.hover} cursor-pointer transition-all duration-300 animate-fade-in`}
    >
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-medium text-[hsl(var(--muted-foreground))]">{title}</h3>
          <div className={`text-2xl sm:text-3xl font-bold mt-1 ${colorClasses.text}`}>{value}</div>
        </div>
        <div className={`${colorClasses.text}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
