import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface EarningsChartProps {
  type?: "bar" | "pie";
  data: any[];
}

const COLORS = {
  digital: "#4F46E5",
  awe: "#10B981",
  creative: "#F59E0B",
  technical: "#EF4444",
};

const EarningsChart = ({ type = "bar", data }: EarningsChartProps) => {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="digital" fill={COLORS.digital} name="Digital" />
        <Bar dataKey="awe" fill={COLORS.awe} name="AWE" />
        <Bar dataKey="creative" fill={COLORS.creative} name="Creative" />
        <Bar dataKey="technical" fill={COLORS.technical} name="Technical" />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default EarningsChart;
