import React from "react";
import { UserCheck, Users, ChevronRight } from "lucide-react";

export const GenderSummary = ({ genderStats }) => (
  <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] p-4 sm:p-8 rounded-xl animate-slide-in shadow-sm hover-lift">
    <div className="flex items-center justify-between mb-6 sm:mb-8">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-[hsl(var(--foreground))] tracking-tight">
          Gender Summary
        </h2>
        <p className="text-xs sm:text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Distribution of candidates by gender
        </p>
      </div>
      <ChevronRight className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
      <div className="text-center p-4 sm:p-6 rounded-xl bg-[hsl(var(--navy-light))] transition-all duration-300 hover:shadow-lg">
        <p className="text-sm sm:text-base text-[hsl(var(--muted-foreground))] font-medium tracking-wide">
          Male Candidates
        </p>
        <p className="text-2xl sm:text-4xl font-bold text-[hsl(var(--navy))] mt-3 tracking-tight stat-value">
          {genderStats.male.total}
        </p>
        <p className="text-xs sm:text-sm text-[hsl(var(--teal))] mt-3 font-medium flex items-center justify-center gap-1">
          <UserCheck className="w-4 h-4" /> {genderStats.male.passed} Passed
        </p>
      </div>
      <div className="text-center p-4 sm:p-6 rounded-xl bg-[hsl(var(--pink-light))] transition-all duration-300 hover:shadow-lg">
        <p className="text-sm sm:text-base text-[hsl(var(--muted-foreground))] font-medium tracking-wide">
          Female Candidates
        </p>
        <p className="text-2xl sm:text-4xl font-bold text-[hsl(var(--pink))] mt-3 tracking-tight stat-value">
          {genderStats.female.total}
        </p>

        <p className="text-xs sm:text-sm text-[hsl(var(--teal))] mt-3 font-medium flex items-center justify-center gap-1">
          <UserCheck className="w-4 h-4" /> {genderStats.female.passed} Passed
        </p>
      </div>
    </div>
  </div>
);
