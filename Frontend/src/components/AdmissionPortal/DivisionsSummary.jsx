import React from "react";
import { ChevronRight } from "lucide-react";
import { domicileOptions } from "../../types/degreeAreas";
import { mergeCategories } from "../../hooks/useReferenceData";

/**
 * Applications per domicile district.
 *
 * Districts are not a database table - they come from `cand_local_domicile`,
 * which the registration form fills from `domicileOptions`. This component
 * used to keep its own duplicate copy of that list, so the two could drift
 * apart silently. It now reads the same source the form writes from, merged
 * with any value actually present in the statistics, which keeps legacy or
 * free-text domiciles visible instead of dropping their counts.
 */
export const DivisionsSummary = ({ divisionStats }) => {
  const stats = divisionStats || {};

  const colorSchemes = [
    "bg-[hsl(var(--navy-light))] text-[hsl(var(--navy))]",
    "bg-[hsl(var(--teal-light))] text-[hsl(var(--teal))]",
    "bg-[hsl(var(--primary))/0.1] text-[hsl(var(--primary))]",
    "bg-[hsl(var(--accent))/0.1] text-[hsl(var(--accent))]",
    "bg-[hsl(var(--pink-light))] text-[hsl(var(--pink))]",
  ];

  const statsByKey = Object.entries(stats).reduce((acc, [name, value]) => {
    acc[String(name).trim().toLowerCase()] = Number(value) || 0;
    return acc;
  }, {});

  const rows = mergeCategories(domicileOptions, Object.keys(stats)).map(
    (division) => ({
      division,
      value: statsByKey[division.trim().toLowerCase()] || 0,
    })
  );

  return (
    <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] p-4 sm:p-8 rounded-xl animate-slide-in shadow-sm hover-lift">
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[hsl(var(--foreground))] tracking-tight">
            Divisions Summary
          </h2>
          <p className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Distribution by geographical divisions
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        {rows.map(({ division, value }, index) => (
          <div
            key={division}
            className={`text-center p-4 sm:p-6 rounded-xl
              ${colorSchemes[index % colorSchemes.length]}
              transition-all duration-300 hover:shadow-lg
            `}
          >
            <p className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))] font-medium tracking-wide mb-2">
              {division}
            </p>
            <p className="text-xl sm:text-2xl font-bold tracking-tight stat-value">
              {value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
