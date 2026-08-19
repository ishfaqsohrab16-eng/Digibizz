import React from "react";
import { BarChart3 } from "lucide-react";
import { mergeCategories, useReferenceData } from "../../hooks/useReferenceData";

/**
 * Applications per course.
 *
 * The course list used to be a hardcoded array of three full names, so
 * renaming a course in the database left the old label showing zero and any
 * fourth course never appeared. Rows now come from the courses table, plus
 * whatever keys the statistics themselves carry so historic counts under a
 * previous name are still visible rather than silently dropped.
 */
export const CourseSummary = ({ courseStats }) => {
  const stats = courseStats || {};
  const { courses, loading } = useReferenceData();

  // The API keys this map by both course_name and course_full_name, so prefer
  // whichever of the two actually has a count for this course.
  const resolveCount = (course) => {
    const candidates = [course.course_full_name, course.course_name];
    for (const key of candidates) {
      if (key && stats[key] !== undefined) return Number(stats[key]) || 0;
    }
    return 0;
  };

  const knownLabels = courses.map((c) => c.course_full_name || c.course_name);
  const rows = mergeCategories(knownLabels, Object.keys(stats)).map((label) => {
    const course = courses.find(
      (c) =>
        (c.course_full_name || "").toLowerCase() === label.toLowerCase() ||
        (c.course_name || "").toLowerCase() === label.toLowerCase()
    );
    return {
      label,
      value: course ? resolveCount(course) : Number(stats[label]) || 0,
    };
  });

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

      {rows.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))] py-6 text-center">
          {loading ? "Loading courses…" : "No courses found."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {rows.map(({ label, value }) => (
            <div
              key={label}
              className="text-center p-4 sm:p-6 rounded-xl bg-[hsl(var(--primary))/0.1] hover:bg-[hsl(var(--primary))/0.15] text-[hsl(var(--primary))] transition-all duration-300 hover:shadow-lg"
            >
              <p className="text-sm text-[hsl(var(--muted-foreground))] font-medium tracking-wide">
                {label}
              </p>
              <p className="text-2xl sm:text-3xl font-bold mt-3 tracking-tight stat-value text-[hsl(var(--primary))]">
                {value}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
