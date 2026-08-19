import { Card } from "../../components/ui/card";
import { TrendingUp, Users, Award, Briefcase, BookOpen } from "lucide-react";
import { CourseSeries } from "../../utils/courseSeries";

interface StatisticsCardsProps {
  statistics: {
    totalEarnings: number;
    /** Earnings per course, keyed by the lower-cased course name. */
    byCourse?: Record<string, number>;
  };
  /** Which course cards to render, in order; empty renders the total only. */
  courses?: CourseSeries[];
}

// Cycled so a fifth or sixth course still gets an icon.
const ICONS = [Briefcase, Award, Users, BookOpen];
const TONES = [
  { color: "text-report-success", bgColor: "bg-report-success/20" },
  { color: "text-report-warning", bgColor: "bg-report-warning/20" },
  { color: "text-report-pending", bgColor: "bg-report-pending/20" },
  { color: "text-report-primary", bgColor: "bg-report-primary/20" },
];

/**
 * Total earnings plus one card per course.
 *
 * Previously this took `totalDigital` / `totalAWE` / `totalCreative` as fixed
 * props, so the three cards were locked to those courses regardless of what
 * the database held.
 */
const StatisticsCards = ({ statistics, courses = [] }: StatisticsCardsProps) => {
  const stats = [
    {
      title: "Total Earnings",
      value: `$${(Number(statistics.totalEarnings) || 0).toLocaleString()}`,
      icon: TrendingUp,
      color: "text-report-primary",
      bgColor: "bg-report-primary/20",
    },
    ...courses.map((course, index) => {
      const tone = TONES[index % TONES.length];
      return {
        title: `${course.label} Earnings`,
        value: `$${(Number(statistics.byCourse?.[course.key]) || 0).toLocaleString()}`,
        icon: ICONS[index % ICONS.length],
        color: tone.color,
        bgColor: tone.bgColor,
      };
    }),
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <Card
          key={`${stat.title}-${index}`}
          className={`p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${stat.bgColor}`}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full">
              <stat.icon className={`h-6 w-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-sm text-gray-500">{stat.title}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default StatisticsCards;
