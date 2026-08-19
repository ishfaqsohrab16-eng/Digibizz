import React from "react";
import { Building2, Users, ChevronRight } from "lucide-react";
import { mergeCategories, useReferenceData } from "../../hooks/useReferenceData";

/**
 * Applications per center, broken down by course and gender.
 *
 * Both the center list and the course list used to be hardcoded arrays here
 * ("BUITEMS", "UoB", ... and "AWE"/"Creative"/"Digital"). A center or course
 * added in the database never appeared, and renaming one made its card show
 * zero while the real count was discarded during the name match. Both lists
 * now come from the database, merged with whatever keys the statistics carry
 * so historic rows under an old name still render.
 */

// Center names arrive from two different queries and have historically carried
// stray and non-breaking whitespace, so compare them loosely. The \s class
// already matches U+00A0, so collapsing runs of it handles both cases.
const normalize = (str) =>
  String(str ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export const CenterSummary = ({ centerStats }) => {
  const { centers, courses, loading } = useReferenceData();
  const stats = centerStats || {};

  const emptyCourse = { total: 0, male: 0, female: 0 };

  // Look up a center's stats by normalised name rather than exact string.
  const statsByCenter = Object.entries(stats).reduce((acc, [name, data]) => {
    acc[normalize(name)] = data;
    return acc;
  }, {});

  const allCourseLabels = mergeCategories(
    courses.map((course) => course.course_name || course.course_full_name),
    // Course keys inside the center breakdown come from courses.course_name.
    Object.values(stats).flatMap((data) => Object.keys(data?.courses || {}))
  );

  // Courses still being offered. Every card shows these, present or not, so
  // the centers stay directly comparable.
  const retiredCourses = new Set(
    courses
      .filter((course) => Number(course.course_status) === 0)
      .map((course) => normalize(course.course_name || course.course_full_name))
  );

  const offeredLabels = allCourseLabels.filter(
    (label) => !retiredCourses.has(normalize(label))
  );

  // If every course is retired, fall back to the full list rather than
  // rendering cards with no rows at all.
  const baseCourseLabels =
    offeredLabels.length > 0 ? offeredLabels : allCourseLabels;

  const centerLabels = mergeCategories(
    centers.map((center) => center.center_name),
    Object.keys(stats)
  );

  const rows = centerLabels.map((centerName) => {
    const data = statsByCenter[normalize(centerName)] || {};
    const courseData = data.courses || {};

    // Course counts are keyed by name; match them the same loose way.
    const courseByKey = Object.entries(courseData).reduce((acc, [name, value]) => {
      acc[normalize(name)] = value;
      return acc;
    }, {});

    // The offered courses, plus any retired course this particular center
    // still has candidates in. That keeps a legacy count like MCKRU's
    // "Technical 3" visible without adding a zero row to all twelve cards.
    const extraLabels = allCourseLabels.filter(
      (label) =>
        !baseCourseLabels.includes(label) &&
        Number(courseByKey[normalize(label)]?.total) > 0
    );

    return {
      name: centerName,
      total: Number(data.total) || 0,
      male: Number(data.male) || 0,
      female: Number(data.female) || 0,
      courses: [...baseCourseLabels, ...extraLabels].map((courseName) => {
        const value = courseByKey[normalize(courseName)] || emptyCourse;
        return {
          name: courseName,
          total: Number(value.total) || 0,
          male: Number(value.male) || 0,
          female: Number(value.female) || 0,
        };
      }),
    };
  });

  // Centers with no applications get one compact line rather than a full card
  // of zeroes each. They are still listed - a center that is open but has had
  // no applicants is worth knowing about - just not at the same weight as one
  // with six hundred.
  const activeRows = rows.filter((row) => row.total > 0);
  const emptyRows = rows.filter((row) => row.total === 0);

  return (
    <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] p-6 rounded-2xl animate-slide-in transform hover:scale-[1.01] transition-all duration-300 shadow-sm">
      <div className="flex items-center justify-between mb-8 group">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[hsl(var(--primary))/0.1] rounded-xl group-hover:bg-[hsl(var(--primary))/0.15] transition-colors duration-300">
            <Building2 className="w-6 h-6 text-[hsl(var(--primary))] group-hover:scale-110 transition-transform duration-300" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[hsl(var(--foreground))] tracking-tight group-hover:text-[hsl(var(--primary))] transition-colors">
              Center Summary
            </h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              Training center enrollment statistics
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[hsl(var(--primary))] text-sm font-medium">
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))] py-6 text-center">
          {loading ? "Loading centers…" : "No centers found."}
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {activeRows.map((center, index) => (
            <div
              key={center.name}
              className="bg-[hsl(var(--card))] rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-500 border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))/0.4] group animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex justify-between items-center mb-5 pb-4 border-b border-[hsl(var(--border))] group-hover:border-[hsl(var(--primary))/0.2] transition-colors duration-300">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[hsl(var(--primary))/0.1] rounded-lg group-hover:bg-[hsl(var(--primary))/0.15] transition-colors duration-300">
                    <Users className="w-5 h-5 text-[hsl(var(--primary))] group-hover:scale-110 transition-transform duration-300" />
                  </div>
                  <h3 className="text-lg font-bold text-[hsl(var(--foreground))] group-hover:text-[hsl(var(--primary))] transition-colors">
                    {center.name}
                  </h3>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-2xl font-bold text-[hsl(var(--primary))] hover-lift group-hover:scale-110 transition-transform duration-300">
                    {center.total}
                  </span>
                  <span className="text-sl text-[hsl(var(--muted-foreground))]">
                    Total Students
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {center.courses.map((course) => (
                  <div
                    key={`${center.name}-${course.name}`}
                    className="flex justify-between items-center group/item hover:bg-[hsl(var(--primary))/0.05] p-2 rounded-lg transition-all duration-300 hover:shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[hsl(var(--primary))/0.7] group-hover/item:scale-125 transition-transform duration-300"></div>
                      <span className="text-sl font-medium text-[hsl(var(--foreground))] group-hover/item:text-[hsl(var(--primary))] transition-colors">
                        {course.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-sl font-bold text-[hsl(var(--primary))]">
                          {course.total}
                        </span>
                        <span className="text-[hsl(var(--muted-foreground))] mx-1">
                          •
                        </span>
                        <span className="text-sl text-[hsl(var(--muted-foreground))]">
                          <span className="text-[hsl(var(--teal))] font-medium">
                            {course.male}M
                          </span>
                          <span className="mx-1">/</span>
                          <span className="text-[hsl(var(--pink))] font-medium">
                            {course.female}F
                          </span>
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[hsl(var(--border))] group-hover/item:text-[hsl(var(--primary))] group-hover/item:translate-x-1 transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {emptyRows.length > 0 && (
        <div className="mt-6 pt-4 border-t border-[hsl(var(--border))]">
          <p className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))] font-medium">
            No applications yet
          </p>
          <p className="mt-1.5 text-sm text-[hsl(var(--muted-foreground))]">
            {emptyRows.map((center) => center.name).join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
};
