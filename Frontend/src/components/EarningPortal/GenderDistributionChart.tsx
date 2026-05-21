import React from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

interface GenderDistributionChartProps {
  maleCount: number;
  femaleCount: number;
}

const GenderDistributionChart: React.FC<GenderDistributionChartProps> = ({
  maleCount,
  femaleCount,
}) => {
  const data = {
    labels: ["Male", "Female"],
    datasets: [
      {
        label: "Gender Distribution",
        data: [maleCount, femaleCount],
        backgroundColor: ["rgba(25, 157, 245, 0.2)", "rgba(250, 58, 99, 0.2)"],
        borderColor: ["rgb(19, 97, 243)", "rgba(255, 35, 108, 0.94)"],
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const label = context.label || "";
            const value = context.raw || 0;
            return `${label}: ${value}`;
          },
        },
      },
    },
  };

  return <Pie data={data} options={options} />;
};

export default GenderDistributionChart;
