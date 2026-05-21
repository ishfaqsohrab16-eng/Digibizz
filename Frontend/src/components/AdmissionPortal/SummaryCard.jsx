import React, { useEffect, useState } from "react";

export const SummaryCard = ({
  title,
  value,
  icon: Icon,
  color = "text-gray-700",
  delay = 0,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`card-hover card-glow bg-white p-4 sm:p-6 rounded-xl shadow-sm gradient-border transition-all duration-300 
        ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
    >
      <div className="flex items-center justify-between group">
        <div className="flex-1">
          <p className="text-xs sm:text-sm text-gray-600 font-medium tracking-wide">
            {title}
          </p>
          <p
            className={`text-xl sm:text-3xl font-bold mt-2 ${color} stat-value tracking-tight`}
          >
            {value}
          </p>
        </div>
        <div
          className={`p-3 sm:p-4 rounded-xl ${color} bg-opacity-10 transition-all duration-300 group-hover:scale-110 animate-float`}
        >
          <Icon
            className={`w-6 h-6 sm:w-8 sm:h-8 ${color}`}
            strokeWidth={1.5}
          />
        </div>
      </div>
    </div>
  );
};
