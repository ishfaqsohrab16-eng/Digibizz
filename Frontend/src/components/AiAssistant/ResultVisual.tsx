import React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AiQuery, AiVisual } from "../../services/api";

/**
 * One thing the assistant asked to have drawn.
 *
 * The spec has already been checked against the actual result columns on the
 * server, so this does not have to defend against a chart of a field that is
 * not there. What it does defend against is the shape of real data: values
 * arriving as strings because MySQL returns DECIMAL and COUNT as text, and
 * category labels long enough to overlap each other on an axis.
 */

/**
 * Chart colours.
 *
 * Taken from the program's own green rather than a library default, so a chart
 * the assistant produced does not look like it came from somewhere else.
 */
const COLOURS = [
  "#006537",
  "#2f7d4f",
  "#57a773",
  "#84c99b",
  "#b3e0c2",
  "#0f766e",
  "#0ea5e9",
  "#6366f1",
];

/**
 * MySQL returns COUNT() and DECIMAL as strings, so a chart fed the raw rows
 * plots nothing and draws no error. Every numeric field is coerced once here
 * rather than hoped about at each use.
 */
const toNumber = (value: any) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** Long category names collide on an axis; shortened with the full text on hover. */
const shorten = (value: any, max = 18) => {
  const text = String(value ?? "");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

const formatCell = (value: any) => {
  if (value === null || value === undefined) return "—";
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const Panel: React.FC<{ title?: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4">
    {title && (
      <h4 className="mb-3 text-sm font-semibold text-slate-800">{title}</h4>
    )}
    {children}
  </div>
);

const DataTable: React.FC<{ rows: Array<Record<string, any>> }> = ({ rows }) => {
  const columns = Object.keys(rows[0] || {});

  return (
    // Its own scroll container: a wide result must not push the whole
    // conversation sideways.
    <div className="max-h-96 overflow-auto rounded border border-slate-200">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50">
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            {columns.map((column) => (
              <th key={column} className="whitespace-nowrap px-3 py-2">
                {column.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-slate-100">
              {columns.map((column) => (
                <td key={column} className="whitespace-nowrap px-3 py-1.5 text-slate-700">
                  {formatCell(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ResultVisual: React.FC<{ visual: AiVisual; query: AiQuery }> = ({
  visual,
  query,
}) => {
  const rows = query.rows || [];
  if (rows.length === 0) return null;

  if (visual.type === "stat") {
    const value = rows[0]?.[visual.valueField];
    return (
      <div className="mt-3 inline-block min-w-[10rem] rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
          {visual.title || visual.valueField.replace(/_/g, " ")}
        </p>
        <p className="mt-1 text-3xl font-bold text-emerald-900">
          {formatCell(value)}
        </p>
      </div>
    );
  }

  if (visual.type === "table") {
    return (
      <Panel title={visual.title}>
        <DataTable rows={rows} />
        {query.rowCount > rows.length && (
          <p className="mt-2 text-xs text-slate-500">
            Showing {rows.length} of {query.rowCount} rows.
          </p>
        )}
      </Panel>
    );
  }

  if (visual.type === "pie") {
    const data = rows.map((row) => ({
      name: String(row[visual.labelField] ?? "—"),
      value: toNumber(row[visual.valueField]),
    }));

    return (
      <Panel title={visual.title}>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={95}
              label={(entry: any) => `${entry.name}: ${entry.value}`}
            >
              {data.map((_, index) => (
                <Cell key={index} fill={COLOURS[index % COLOURS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </Panel>
    );
  }

  // bar | line | area
  const data = rows.map((row) => {
    const point: Record<string, any> = {
      // Kept whole for the tooltip; the axis shows the shortened form.
      [visual.xField]: String(row[visual.xField] ?? "—"),
    };
    for (const field of visual.yFields) point[field] = toNumber(row[field]);
    return point;
  });

  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
      <XAxis
        dataKey={visual.xField}
        tick={{ fontSize: 12 }}
        tickFormatter={(value) => shorten(value)}
        interval="preserveStartEnd"
      />
      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
      <Tooltip />
      {visual.yFields.length > 1 && <Legend />}
    </>
  );

  return (
    <Panel title={visual.title}>
      <ResponsiveContainer width="100%" height={300}>
        {visual.type === "line" ? (
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            {axes}
            {visual.yFields.map((field, index) => (
              <Line
                key={field}
                type="monotone"
                dataKey={field}
                stroke={COLOURS[index % COLOURS.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        ) : visual.type === "area" ? (
          <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            {axes}
            {visual.yFields.map((field, index) => (
              <Area
                key={field}
                type="monotone"
                dataKey={field}
                stroke={COLOURS[index % COLOURS.length]}
                fill={COLOURS[index % COLOURS.length]}
                fillOpacity={0.25}
              />
            ))}
          </AreaChart>
        ) : (
          <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            {axes}
            {visual.yFields.map((field, index) => (
              <Bar
                key={field}
                dataKey={field}
                fill={COLOURS[index % COLOURS.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </Panel>
  );
};

export default ResultVisual;
