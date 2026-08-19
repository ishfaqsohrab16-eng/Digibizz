import {
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  Label,
  Cell,
} from "recharts";
import { Info } from "lucide-react";
import { CourseSeries } from "../../utils/courseSeries";

/** One row per batch, with earnings stored under each lower-cased course name. */
interface ChartData {
  batchName: string;
  total: number;
  [courseKey: string]: any;
}

interface BatchEarningsChartProps {
  data: ChartData[];
  /** Trend line per course; replaces the old fixed four-course set. */
  courses: CourseSeries[];
}

const ProfessionalEarningsChart = ({
  data,
  courses,
}: BatchEarningsChartProps) => {
  // Color palette designed for accessibility and professional presentation.
  // Per-course colours now come from the series so they stay consistent with
  // the other earning charts however many courses exist.
  const theme = {
    total: "#475569",
    background: "#FFFFFF",
    text: {
      primary: "#1E293B",
      secondary: "#64748B",
    },
  };

  if (!data || data.length === 0) {
    return (
      <div className="h-[480px] flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200 p-6">
        <div className="text-slate-400 mb-4">
          <Info size={40} />
        </div>
        <h3 className="text-lg font-semibold text-slate-800 mb-2">
          No earnings data available
        </h3>
        <p className="text-sm text-slate-500 text-center max-w-xs">
          Earnings data will appear here once batches are completed and
          transactions are processed.
        </p>
      </div>
    );
  }

  const processedData = data.map((item) => ({
    ...item,
    total: courses.reduce(
      (sum, course) => sum + (Number(item[course.key]) || 0),
      0
    ),
  }));

  // Calculate average for reference line
  const averageTotal =
    processedData.reduce((acc, cur) => acc + cur.total, 0) /
    processedData.length;

  return (
    <div className="w-full h-[480px] bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-800">
          Batch Earnings Performance
        </h3>
        <p className="text-sm text-slate-500">
          Total earnings distribution across training batches
        </p>
      </div>

      <ResponsiveContainer width="100%" height="80%">
        <ComposedChart
          data={processedData}
          margin={{ top: 0, right: 30, left: 30, bottom: 20 }}
        >
          <defs>
            <linearGradient id="totalBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={theme.total} stopOpacity={0.8} />
              <stop offset="95%" stopColor={theme.total} stopOpacity={0.2} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke={theme.text.secondary}
            strokeOpacity={0.2}
          />

          <XAxis
            dataKey="batchName"
            tick={{ fill: theme.text.secondary }}
            axisLine={{ stroke: theme.text.secondary, strokeOpacity: 0.2 }}
            tickLine={{ stroke: theme.text.secondary, strokeOpacity: 0.2 }}
            padding={{ left: 15, right: 15 }}
          />

          <YAxis
            yAxisId="left"
            orientation="left"
            tick={{ fill: theme.text.secondary }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) =>
              `$${new Intl.NumberFormat().format(value)}`
            }
          />

          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: theme.text.secondary }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) =>
              `$${new Intl.NumberFormat().format(value)}`
            }
          />

          <ReferenceLine
            y={averageTotal}
            yAxisId="left"
            stroke={theme.total}
            strokeDasharray="5 5"
            strokeOpacity={0.5}
          >
            <Label
              value={`Avg: $${new Intl.NumberFormat().format(averageTotal)}`}
              position="insideTopRight"
              fill={theme.text.secondary}
              fontSize={12}
            />
          </ReferenceLine>

          <Tooltip
            content={({ payload }) => (
              <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
                <p className="font-semibold text-slate-800 mb-2">
                  {payload?.[0]?.payload.batchName}
                </p>
                <div className="space-y-1">
                  {payload?.map((entry, index) => (
                    <div key={index} className="flex items-center text-sm">
                      <div className="w-3 h-3 rounded-sm mr-2" />
                      <span className="text-slate-600">{entry.name}:</span>
                      <span className="ml-2 font-medium text-slate-800">
                        ${new Intl.NumberFormat().format(Number(entry.value))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          />

          <Legend
            wrapperStyle={{
              paddingTop: "20px",
              paddingBottom: "10px",
            }}
            content={({ payload }) => (
              <div className="flex flex-wrap gap-4 justify-center">
                {payload?.map((entry, index) => (
                  <div
                    key={index}
                    className="flex items-center text-sm text-secondary"
                  >
                    <div className="w-3 h-3 rounded-sm mr-2 bg-primary-400" />
                    {entry.value}
                  </div>
                ))}
              </div>
            )}
          />

          {/* Total Earnings Bar */}
          <Bar
            yAxisId="left"
            dataKey="total"
            fill="url(#totalBar)"
            name="Total Earnings"
            radius={[4, 4, 0, 0]}
            barSize={32}
          >
            {processedData.map((entry, index) => (
              <Cell
                key={index}
                fill="url(#totalBar)"
                stroke={theme.total}
                strokeWidth={index === processedData.length - 1 ? 2 : 0}
              />
            ))}
          </Bar>

          {/* Trend Lines - one per course actually present in the data */}
          {courses.map((course) => (
            <Line
              key={course.key}
              yAxisId="right"
              type="monotone"
              dataKey={course.key}
              stroke={course.color}
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 6,
                fill: course.color,
                stroke: theme.background,
                strokeWidth: 2,
              }}
              strokeOpacity={0.8}
              name={course.label}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-4 text-xs text-slate-500 text-center">
        <span className="inline-block mx-2">
          • Total earnings shown as vertical bars
        </span>
        <span className="inline-block mx-2">
          • Dashed line indicates average across batches
        </span>
        <span className="inline-block mx-2">
          • Trend lines represent individual course earnings
        </span>
      </div>
    </div>
  );
};

export default ProfessionalEarningsChart;
