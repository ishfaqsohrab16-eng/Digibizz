import React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Pie,
  PieChart,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from "recharts";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { AiQuery, AiVisual } from "../../services/api";

/**
 * One thing the assistant asked to have drawn.
 *
 * The spec has already been checked against the actual result columns on the
 * server, so this does not defend against a chart of a field that is not there.
 * What it does defend against is the shape of real data: values arriving as
 * strings because MySQL returns COUNT and DECIMAL as text, and category labels
 * long enough to overlap on an axis.
 */

/**
 * Chart colours.
 *
 * The first version was five shades of the programme's green in a row, which
 * looked tidy and was unreadable: a male/female bar pair came out as two greens
 * a few percent apart, and the legend was the only way to tell them apart.
 *
 * Series are distinguished by HUE, not by lightness. The programme's green
 * leads so a chart still looks like it belongs here, and every colour after it
 * is clearly different. They also stay distinguishable in the two common forms
 * of colour blindness, which shades of a single hue do not.
 */
const COLOURS = [
  "#006537", // programme green
  "#e07a1f", // orange - the strongest contrast against the green
  "#2563eb", // blue
  "#a21caf", // purple
  "#0891b2", // teal
  "#b45309", // amber
  "#be123c", // rose
  "#4d7c0f", // olive
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

/** Long category names collide on an axis; shortened, with the full text in the tooltip. */
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

/** A filename that survives Windows, Excel's 31-character sheet limit, and a URL. */
const safeName = (title: string, fallback: string) => {
  const cleaned = String(title || "")
    .replace(/[\\/:*?"<>|]/g, "")
    .trim();
  return (cleaned || fallback).slice(0, 60);
};

/**
 * Download a dataset as a real .xlsx.
 *
 * Not CSV. Every one of these tables has centre and course names in it, and
 * Excel mangles a CSV the moment a value contains a comma or leads with a
 * digit - which roll numbers and CNICs both do. A workbook keeps the columns
 * where they were put.
 */
const downloadExcel = (rows: Array<Record<string, any>>, title: string) => {
  try {
    if (!rows || rows.length === 0) {
      toast.error("There is nothing to download");
      return;
    }

    const sheet = XLSX.utils.json_to_sheet(rows);

    // Column widths from the content, so the file opens readable instead of
    // showing ##### and needing every column dragged out by hand.
    const columns = Object.keys(rows[0]);
    sheet["!cols"] = columns.map((column) => ({
      wch: Math.min(
        40,
        Math.max(
          column.length + 2,
          ...rows.slice(0, 200).map((row) => String(row[column] ?? "").length + 2)
        )
      ),
    }));

    const book = XLSX.utils.book_new();
    // Excel refuses a sheet name over 31 characters or containing : \ / ? * [ ]
    XLSX.utils.book_append_sheet(book, sheet, safeName(title, "Data").slice(0, 31));
    XLSX.writeFile(book, `${safeName(title, "digibizz-data")}.xlsx`);
  } catch (error) {
    console.error("Excel export failed:", error);
    toast.error("Could not build the Excel file");
  }
};

const Panel: React.FC<{
  title?: string;
  rows: Array<Record<string, any>>;
  children: React.ReactNode;
}> = ({ title, rows, children }) => (
  <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-3 flex items-start justify-between gap-3">
      {title ? (
        <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
      ) : (
        <span />
      )}
      <button
        onClick={() => downloadExcel(rows, title || "data")}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700"
        title="Download this data as an Excel file"
      >
        <Download className="h-3.5 w-3.5" />
        Excel
      </button>
    </div>
    {children}
  </div>
);

const DataTable: React.FC<{ rows: Array<Record<string, any>> }> = ({ rows }) => {
  const columns = Object.keys(rows[0] || {});

  return (
    // Its own scroll container: a wide result must not push the conversation
    // sideways.
    <div className="max-h-[26rem] overflow-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-slate-50">
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            {columns.map((column) => (
              <th key={column} className="whitespace-nowrap px-3 py-2 font-semibold">
                {column.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={index}
              className="border-t border-slate-100 odd:bg-white even:bg-slate-50/50 hover:bg-emerald-50/40"
            >
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

/** A ranked list: the shape a "top five" answer actually wants. */
const RankedList: React.FC<{
  rows: Array<Record<string, any>>;
  labelField: string;
  valueField: string;
}> = ({ rows, labelField, valueField }) => {
  const max = Math.max(...rows.map((row) => toNumber(row[valueField])), 1);

  return (
    <ol className="space-y-1.5">
      {rows.slice(0, 25).map((row, index) => {
        const value = toNumber(row[valueField]);
        return (
          <li key={index} className="flex items-center gap-3">
            <span className="w-5 shrink-0 text-right text-xs font-medium text-slate-400">
              {index + 1}
            </span>
            <span className="w-44 shrink-0 truncate text-sm text-slate-700" title={String(row[labelField])}>
              {formatCell(row[labelField])}
            </span>
            {/* The bar is the comparison; the number is the fact. */}
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <span
                className="block h-full rounded-full bg-emerald-600"
                style={{ width: `${(value / max) * 100}%` }}
              />
            </span>
            <span className="w-16 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-800">
              {formatCell(row[valueField])}
            </span>
          </li>
        );
      })}
    </ol>
  );
};

const ResultVisual: React.FC<{ visual: AiVisual; query: AiQuery }> = ({
  visual,
  query,
}) => {
  const rows = query?.rows || [];
  if (rows.length === 0) return null;

  const v = visual as any;

  // ---------------------------------------------------------------- stat
  if (visual.type === "stat") {
    const value = rows[0]?.[v.valueField];
    return (
      <div className="mt-3 inline-flex min-w-[11rem] flex-col rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white px-5 py-4 shadow-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-emerald-800">
          {visual.title || String(v.valueField).replace(/_/g, " ")}
        </span>
        <span className="mt-1 text-3xl font-bold tabular-nums text-emerald-900">
          {formatCell(value)}
        </span>
      </div>
    );
  }

  // --------------------------------------------------------------- table
  if (visual.type === "table") {
    return (
      <Panel title={visual.title} rows={rows}>
        <DataTable rows={rows} />
        {query.rowCount > rows.length && (
          <p className="mt-2 text-xs text-slate-500">
            Showing {rows.length} of {query.rowCount} rows.
          </p>
        )}
      </Panel>
    );
  }

  // ---------------------------------------------------------------- list
  if (visual.type === "list") {
    return (
      <Panel title={visual.title} rows={rows}>
        <RankedList rows={rows} labelField={v.labelField} valueField={v.valueField} />
      </Panel>
    );
  }

  // ------------------------------------------------- pie, donut, treemap,
  // ------------------------------------------------- funnel, radial
  const labelled = () =>
    rows.map((row) => ({
      name: String(row[v.labelField] ?? "—"),
      value: toNumber(row[v.valueField]),
    }));

  if (visual.type === "pie" || visual.type === "donut") {
    const data = labelled();
    return (
      <Panel title={visual.title} rows={rows}>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              // The hole is the only difference; a donut reads better when the
              // total is not itself meaningful.
              innerRadius={visual.type === "donut" ? 62 : 0}
              outerRadius={100}
              paddingAngle={visual.type === "donut" ? 2 : 0}
              label={(entry: any) => `${shorten(entry.name, 14)}: ${entry.value}`}
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

  if (visual.type === "treemap") {
    return (
      <Panel title={visual.title} rows={rows}>
        <ResponsiveContainer width="100%" height={320}>
          <Treemap
            data={labelled()}
            dataKey="value"
            nameKey="name"
            stroke="#fff"
            content={<TreemapCell />}
          />
        </ResponsiveContainer>
      </Panel>
    );
  }

  if (visual.type === "funnel") {
    return (
      <Panel title={visual.title} rows={rows}>
        <ResponsiveContainer width="100%" height={320}>
          <FunnelChart>
            <Tooltip />
            <Funnel dataKey="value" data={labelled()} isAnimationActive>
              <LabelList position="right" fill="#334155" stroke="none" dataKey="name" />
              <LabelList position="center" fill="#fff" stroke="none" dataKey="value" />
              {labelled().map((_, index) => (
                <Cell key={index} fill={COLOURS[index % COLOURS.length]} />
              ))}
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
      </Panel>
    );
  }

  if (visual.type === "radial") {
    const data = labelled().map((entry, index) => ({
      ...entry,
      fill: COLOURS[index % COLOURS.length],
    }));
    return (
      <Panel title={visual.title} rows={rows}>
        <ResponsiveContainer width="100%" height={320}>
          <RadialBarChart
            data={data}
            innerRadius="25%"
            outerRadius="95%"
            startAngle={90}
            endAngle={-270}
          >
            <RadialBar dataKey="value" background cornerRadius={6} />
            <Legend iconSize={10} layout="vertical" verticalAlign="middle" align="right" />
            <Tooltip />
          </RadialBarChart>
        </ResponsiveContainer>
      </Panel>
    );
  }

  // -------------------------------------- bar, hbar, stackedBar, line,
  // -------------------------------------- area, radar, scatter
  const xField = v.xField as string;
  const yFields = (v.yFields || []) as string[];

  const data = rows.map((row) => {
    const point: Record<string, any> = {
      // Kept whole for the tooltip; the axis shows the shortened form.
      [xField]: String(row[xField] ?? "—"),
    };
    for (const field of yFields) point[field] = toNumber(row[field]);
    return point;
  });

  const legend = yFields.length > 1 ? <Legend iconSize={10} /> : null;

  const cartesianAxes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
      <XAxis
        dataKey={xField}
        tick={{ fontSize: 12 }}
        tickFormatter={(value) => shorten(value)}
        interval="preserveStartEnd"
      />
      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
      <Tooltip />
      {legend}
    </>
  );

  // Horizontal bars, for when the categories are centre names and would
  // otherwise be shortened to nothing on a vertical axis.
  if (visual.type === "hbar") {
    return (
      <Panel title={visual.title} rows={rows}>
        <ResponsiveContainer width="100%" height={Math.max(240, data.length * 34 + 60)}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey={xField}
              tick={{ fontSize: 12 }}
              width={140}
              tickFormatter={(value) => shorten(value, 20)}
            />
            <Tooltip />
            {legend}
            {yFields.map((field, index) => (
              <Bar
                key={field}
                dataKey={field}
                fill={COLOURS[index % COLOURS.length]}
                radius={[0, 4, 4, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    );
  }

  if (visual.type === "radar") {
    return (
      <Panel title={visual.title} rows={rows}>
        <ResponsiveContainer width="100%" height={330}>
          <RadarChart data={data} outerRadius="75%">
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey={xField} tick={{ fontSize: 11 }} />
            <PolarRadiusAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            {legend}
            {yFields.map((field, index) => (
              <Radar
                key={field}
                dataKey={field}
                stroke={COLOURS[index % COLOURS.length]}
                fill={COLOURS[index % COLOURS.length]}
                fillOpacity={0.25}
              />
            ))}
          </RadarChart>
        </ResponsiveContainer>
      </Panel>
    );
  }

  if (visual.type === "scatter") {
    return (
      <Panel title={visual.title} rows={rows}>
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey={xField}
              type="number"
              name={xField}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              dataKey={yFields[0]}
              type="number"
              name={yFields[0]}
              tick={{ fontSize: 12 }}
            />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            {legend}
            {yFields.map((field, index) => (
              <Scatter
                key={field}
                name={field}
                data={rows.map((row) => ({
                  [xField]: toNumber(row[xField]),
                  [field]: toNumber(row[field]),
                }))}
                fill={COLOURS[index % COLOURS.length]}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </Panel>
    );
  }

  return (
    <Panel title={visual.title} rows={rows}>
      <ResponsiveContainer width="100%" height={310}>
        {visual.type === "line" ? (
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            {cartesianAxes}
            {yFields.map((field, index) => (
              <Line
                key={field}
                type="monotone"
                dataKey={field}
                stroke={COLOURS[index % COLOURS.length]}
                strokeWidth={2.5}
                dot={data.length <= 30}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        ) : visual.type === "area" ? (
          <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            {cartesianAxes}
            {yFields.map((field, index) => (
              <Area
                key={field}
                type="monotone"
                dataKey={field}
                stroke={COLOURS[index % COLOURS.length]}
                fill={COLOURS[index % COLOURS.length]}
                fillOpacity={0.22}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        ) : (
          <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            {cartesianAxes}
            {yFields.map((field, index) => (
              <Bar
                key={field}
                dataKey={field}
                // Stacking is what turns "parts of a whole" into one bar per
                // category instead of several side by side.
                stackId={visual.type === "stackedBar" ? "a" : undefined}
                fill={COLOURS[index % COLOURS.length]}
                radius={visual.type === "stackedBar" ? undefined : [4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </Panel>
  );
};

/**
 * Treemap tiles.
 *
 * Recharts' default draws no labels at all, which makes a treemap a grid of
 * anonymous rectangles. This writes the name and value into any tile with room
 * for them and leaves the rest to the tooltip.
 */
const TreemapCell = (props: any) => {
  const { x, y, width, height, index, name, value } = props;
  const fill = COLOURS[(index ?? 0) % COLOURS.length];

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={2} />
      {width > 70 && height > 34 && (
        <>
          <text x={x + 8} y={y + 20} fill="#fff" fontSize={12} fontWeight={600}>
            {shorten(name, Math.floor(width / 8))}
          </text>
          <text x={x + 8} y={y + 36} fill="#ffffffcc" fontSize={11}>
            {value}
          </text>
        </>
      )}
    </g>
  );
};

export default ResultVisual;
