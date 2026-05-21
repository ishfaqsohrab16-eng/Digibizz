import { Card } from "../../components/ui/card";
import { TrendingUp, Users, Award, Briefcase } from "lucide-react";

interface StatisticsCardsProps {
  statistics: {
    totalEarnings: number;
    totalDigital: number;
    totalAWE: number;
    totalCreative: number;
  };
}

const StatisticsCards = ({ statistics }: StatisticsCardsProps) => {
  const stats = [
    {
      title: "Total Earnings",
      value: `$${statistics.totalEarnings.toLocaleString()}`,
      icon: TrendingUp,
      color: "text-report-primary",
      bgColor: "bg-report-primary/20",
    },
    {
      title: "Digital Earnings",
      value: `$${statistics.totalDigital.toLocaleString()}`,
      icon: Briefcase,
      color: "text-report-success",
      bgColor: "bg-report-success/20",
    },
    {
      title: "AWE Earnings",
      value: `$${statistics.totalAWE.toLocaleString()}`,
      icon: Award,
      color: "text-report-warning",
      bgColor: "bg-report-warning/20",
    },
    {
      title: "Creative Earnings",
      value: `$${statistics.totalCreative.toLocaleString()}`,
      icon: Users,
      color: "text-report-pending",
      bgColor: "bg-report-pending/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <Card
          key={index}
          className={`p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${stat.bgColor}`}
        >
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-full `}>
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
