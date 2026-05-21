import React from "react";
import { cn } from "../../../lib/utils";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: string;
  className?: string;
  onClick?: () => void;
}

const FeatureCard: React.FC<FeatureCardProps> = ({
  title,
  description,
  icon,
  action,
  className,
  onClick,
}) => {
  return (
    <div
      className={cn(
        "feature-card bg-white p-6 rounded-lg border border-gray-100 shadow-sm",
        "transition-all duration-300 hover:shadow-md hover:-translate-y-1 cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      <div className="feature-card-icon mb-4 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2 text-gray-800">{title}</h3>
      <p className="text-gray-600 mb-4">{description}</p>
      {action && (
        <button className="text-dashboard-navy font-medium text-sm hover:underline transition-all">
          {action}
        </button>
      )}
    </div>
  );
};

export default FeatureCard;
