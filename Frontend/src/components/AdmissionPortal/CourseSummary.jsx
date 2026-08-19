import React from "react";
import { BarChart3 } from "lucide-react";
import { useReferenceData } from "../../hooks/useReferenceData";

const norm = (value) => String(value ?? "").trim().toLowerCase();

/**
 * Applications per course.
 *
 * The course list used to be a hardcoded array of three full names, so
 * renaming a course in the database left the old label showing zero and any
 * fourth course never appeared.
 *
 * The statistics arrive keyed by BOTH course_name and course_full_name -
 * "AWE" and "Amazon Web and e-Commerce" are the same course carrying the same
 * count. Treating the keys as a plain list therefore rendered every course
 * twice. Rows are built one-per-course from the courses table instead, and a
 * statistics key only becomes its own row when it matches no course at all,
 * which is what keeps a renamed course's historic count visible.
 */
export const CourseSummary = ({ courseStats }) => {
  const stats = courseStats || {};
  const { courses, loading } = useReferenceData();

  // Prefer whichever of the two aliases actually carries a count.
  const resolveCount = (course) => {
    for (const key of [course.course_full_name, course.course_name]) {
      if (key && stats[key] !== undefined) return Number(stats[key]) || 0;
    }
    return 0;
  };

  // One row per course in the database. A retired course (course_status 0)
  // only appears if it still has applications behind it - "Technical" is
  // retired but carries historic candidates, and hiding it would lose them.
  const rows = courses
    .map((course) => ({
      label: course.course_full_name || course.course_name,
      value: resolveCount(course),
      retired: Number(course.course_status) === 0,
    }))
    .filter((row) => !row.retired || row.value > 0);

  // Every name a known course answers to, so its aliases are not re-added below.
  const claimed = new Set(
    courses.flatMap((course) =>
      [course.course_name, course.course_full_name].filter(Boolean).map(norm)
    )
  );

  for (const [key, value] of Object.entries(stats)) {
    if (!key || claimed.has(norm(key))) continue;
    claimed.add(norm(key));
    rows.push({ label: key, value: Number(value) || 0 });
  }

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
