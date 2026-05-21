import React from "react";

interface StatsTableProps {
  stats: {
    label: string;
    value: string;
  }[];
}

const StatsTable: React.FC<StatsTableProps> = ({ stats }) => {
  return (
    <div className="bg-card rounded-lg shadow-sm p-6 animate-fade-up">
      <h2 className="text-lg font-semibold mb-4 text-foreground">My DigiBizz Statistics</h2>

      <table className="w-full stats-table">
        <tbody>
          {stats.map((stat, index) => (
            <tr key={index} className={index % 2 === 0 ? "bg-muted/30" : ""}>
              <td className="py-2 text-sm font-medium w-1/3 text-foreground">{stat.label}</td>
              <td className="py-2 text-sm text-foreground">{stat.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StatsTable;
