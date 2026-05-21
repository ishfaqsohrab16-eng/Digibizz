import React from "react";
import { Building2, Users, ChevronRight } from "lucide-react";

// Define all centers and courses
const allCenters = [
  "Govt Girls College, Quetta Cantt",
  "ITTI Pishin Stop QTA",
  "BUITEMS",
  "UoB",
  "UoL",
  "MCKRU",
  "UoG",
  "ITTI Zhob",
  "Derabugti",
  "Awaran"
];
const allCourses = ["AWE", "Creative", "Digital"];

// Helper to normalize center names (replace all whitespace, trim, lowercase)
const normalize = (str) =>
  str
    .replace(/\s+/g, " ") // Replace all whitespace (including non-breaking) with a single space
    .replace(/\u00A0/g, " ") // Replace non-breaking spaces with regular space
    .trim()
    .toLowerCase();

export const CenterSummary = ({ centerStats }) => {
  // Build a map of normalized center names to original names
  const centerNameMap = allCenters.reduce((acc, center) => {
    acc[normalize(center)] = center;
    return acc;
  }, {});

  // Create complete stats object with default values
  const completeStats = allCenters.reduce((acc, center) => {
    acc[center] = {
      total: 0,
      male: 0,
      female: 0,
      courses: allCourses.reduce((courseAcc, course) => {
        courseAcc[course] = {
          total: 0,
          male: 0,
          female: 0,
        };
        return courseAcc;
      }, {}),
    };
    return acc;
  }, {});
  console.log(centerStats);
  // Merge provided stats with default values, using normalized names
  Object.entries(centerStats || {}).forEach(([center, data]) => {
    const normalized = normalize(center);
    const mappedCenter = centerNameMap[normalized];
    if (mappedCenter && completeStats[mappedCenter]) {
      completeStats[mappedCenter].total = data.total || 0;
      completeStats[mappedCenter].male = data.male || 0;
      completeStats[mappedCenter].female = data.female || 0;

      // Handle courses data
      Object.entries(data.courses || {}).forEach(([course, courseData]) => {
        if (completeStats[mappedCenter].courses[course]) {
          completeStats[mappedCenter].courses[course] = {
            total: courseData.total || 0,
            male: courseData.male || 0,
            female: courseData.female || 0,
          };
        }
      });
    }
  });

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
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1 group-hover:text-[hsl(var(--muted-foreground))] transition-colors">
              Training center enrollment statistics
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[hsl(var(--primary))] text-sm font-medium cursor-pointer hover:gap-3 transition-all group">
          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(completeStats).map(([center, data], index) => (
          <div
            key={center}
            className="bg-[hsl(var(--card))] rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-500 border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))/0.4] group animate-fade-in"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex justify-between items-center mb-5 pb-4 border-b border-[hsl(var(--border))] group-hover:border-[hsl(var(--primary))/0.2] transition-colors duration-300">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[hsl(var(--primary))/0.1] rounded-lg group-hover:bg-[hsl(var(--primary))/0.15] transition-colors duration-300">
                  <Users className="w-5 h-5 text-[hsl(var(--primary))] group-hover:scale-110 transition-transform duration-300" />
                </div>
                <h3 className="text-lg font-bold text-[hsl(var(--foreground))] group-hover:text-[hsl(var(--primary))] transition-colors">
                  {center}
                </h3>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-2xl font-bold text-[hsl(var(--primary))] hover-lift group-hover:scale-110 transition-transform duration-300">
                  {data.total}
                </span>
                <span className="text-sl text-[hsl(var(--muted-foreground))] group-hover:text-[hsl(var(--primary))] transition-colors">
                  Total Students
                </span>
              </div>
            </div>

            <div className="space-y-4">
              {Object.entries(data.courses).map(
                ([course, stats], courseIndex) => (
                  <div
                    key={`${center}-${course}`}
                    className="flex justify-between items-center group/item hover:bg-[hsl(var(--primary))/0.05] p-2 rounded-lg transition-all duration-300 hover:shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[hsl(var(--primary))/0.7] group-hover/item:scale-125 transition-transform duration-300"></div>
                      <span className="text-sl font-medium text-[hsl(var(--foreground))] group-hover/item:text-[hsl(var(--primary))] transition-colors">
                        {course}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-sl font-bold text-[hsl(var(--primary))] group-hover/item:text-[hsl(var(--primary))] transition-colors">
                          {stats.total}
                        </span>
                        <span className="text-[hsl(var(--muted-foreground))] mx-1">
                          •
                        </span>
                        <span className="text-sl text-[hsl(var(--muted-foreground))]">
                          <span className="text-[hsl(var(--teal))] font-medium group-hover/item:text-[hsl(var(--teal))] transition-colors">
                            {stats.male}M
                          </span>
                          <span className="mx-1">/</span>
                          <span className="text-[hsl(var(--pink))] font-medium group-hover/item:text-[hsl(var(--pink))] transition-colors">
                            {stats.female}F
                          </span>
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[hsl(var(--border))] group-hover/item:text-[hsl(var(--primary))] group-hover/item:translate-x-1 transition-all" />
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
