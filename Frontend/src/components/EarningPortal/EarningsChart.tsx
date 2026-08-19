import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { CourseSeries } from "../../utils/courseSeries";

interface EarningsChartProps {
  type?: "bar" | "pie";
  /** Rows shaped `{ name, [courseKey]: number }`. */
  data: any[];
  /** One bar per entry; replaces the old fixed four-course bar set. */
  courses: CourseSeries[];
}

const EarningsChart = ({ type = "bar", data, courses }: EarningsChartProps) => {
  if (courses.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        No course data to chart yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        {courses.map((course) => (
          <Bar
            key={course.key}
            dataKey={course.key}
            fill={course.color}
            name={course.label}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};

export default EarningsChart;
