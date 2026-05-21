import React from "react";
import { BarChart3 } from "lucide-react";

// Update the courses list to match your actual courses
const allCourses = [
  "Digital Marketing and Advertising",
  "Amazon Web and e-Commerce",
  "Creative Designing",
];

export const CourseSummary = ({ courseStats }) => {
  const stats = courseStats || {};

  // Create a complete stats object with default values
  const completeStats = allCourses.reduce((acc, course) => {
    acc[course] = stats[course] || 0;
    return acc;
  }, {});

  return (
    <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] p-4 sm:p-8 rounded-xl animate-slide-in shadow-sm hover-lift">
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[hsl(var(--foreground))] tracking-tight">
            Course Summary
          </h2>
          <p className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Distribution by course type
          </p>
        </div>
        <BarChart3 className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {Object.entries(completeStats).map(([course, value]) => (
          <div
            key={course}
            className="text-center p-4 sm:p-6 rounded-xl bg-[hsl(var(--primary))/0.1] hover:bg-[hsl(var(--primary))/0.15] text-[hsl(var(--primary))] transition-all duration-300 hover:shadow-lg"
          >
            <p className="text-sm text-[hsl(var(--muted-foreground))] font-medium tracking-wide">
              {course}
            </p>
            <p className="text-2xl sm:text-3xl font-bold mt-3 tracking-tight stat-value text-[hsl(var(--primary))]">
              {value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
