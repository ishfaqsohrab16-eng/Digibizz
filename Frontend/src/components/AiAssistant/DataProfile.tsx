import React, { useState } from "react";
import {
  BarChart3,
  CalendarRange,
  ChevronDown,
  Fingerprint,
  Hash,
  Lock,
  Shuffle,
  Type,
} from "lucide-react";
import { AiColumnProfile, AiProfile } from "../../services/api";

/**
 * The shape of a result, as cards.
 *
 * These are the SAME figures the model was given - computed once on the server
 * and sent down, not recalculated here. Two implementations of "the average"
 * would eventually disagree, and the number on screen has to be the one the
 * answer was actually based on.
 *
 * It earns its space because the summary above it is prose. "Enrolment is
 * higher for males at every centre" is the finding; this is the range, the
 * total, the gaps in the data and the commonest values behind it, which is
 * what tells you whether to believe the finding.
 */

const number = (value: number | undefined) =>
  value === undefined || value === null
    ? "—"
    : Math.abs(value) >= 1000
      ? value.toLocaleString()
      : String(value);

/** A share of the column, drawn as a bar. Reads faster than the percentage. */
const Share: React.FC<{ value: number; total: number; label: string; count: number }> = ({
  value,
  total,
  label,
  count,
}) => {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="truncate font-medium text-slate-700" title={label}>
          {label}
        </span>
        <span className="shrink-0 tabular-nums text-slate-500">
          {count} · {percent}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
          style={{ width: `${Math.max(percent, 2)}%` }}
        />
      </div>
    </div>
  );
};

/**
 * Icon and colour per role, not per type.
 *
 * A key and a quantity are both numbers and want saying completely
 * differently, which is the whole reason the server labels them.
 */
const LOOK: Record<string, { Icon: typeof Hash; tint: string }> = {
  measure: { Icon: Hash, tint: "text-sky-600 bg-sky-50 ring-sky-100" },
  date: { Icon: CalendarRange, tint: "text-violet-600 bg-violet-50 ring-violet-100" },
  category: { Icon: Type, tint: "text-emerald-600 bg-emerald-50 ring-emerald-100" },
  identifier: { Icon: Fingerprint, tint: "text-slate-500 bg-slate-100 ring-slate-200" },
  constant: { Icon: Lock, tint: "text-amber-600 bg-amber-50 ring-amber-100" },
  unique: { Icon: Shuffle, tint: "text-slate-500 bg-slate-100 ring-slate-200" },
};

const Card: React.FC<{ column: AiColumnProfile; rowCount: number }> = ({ column, rowCount }) => {
  const role =
    column.role || (column.type === "number" ? "measure" : column.type === "date" ? "date" : "category");

  const { Icon, tint } = LOOK[role] || LOOK.category;

  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow">
      <div className="flex items-center gap-2">
        <span className={`flex h-6 w-6 items-center justify-center rounded-lg ring-1 ring-inset ${tint}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className="truncate text-xs font-semibold text-slate-800" title={column.name}>
          {column.name}
        </p>
      </div>

      {/* A quantity. The total leads, because it is the figure people came for. */}
      {role === "measure" && (
        <>
          <p className="mt-2 text-xl font-bold leading-none tracking-tight text-slate-900">
            {number(column.sum)}
          </p>
          <p className="text-[11px] text-slate-500">total</p>
          <dl className="mt-2 grid grid-cols-3 gap-1 border-t border-slate-100 pt-2 text-[11px]">
            {[
              ["min", column.min],
              ["mean", column.mean],
              ["max", column.max],
            ].map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-slate-400">{label}</dt>
                <dd className="truncate font-semibold tabular-nums text-slate-700">
                  {number(value as number)}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}

      {/* An identity. No total: "attempt_id - 3,510 total" was four primary
          keys added together, correct arithmetic about nothing. How many there
          are is the only honest thing to say. */}
      {role === "identifier" && (
        <>
          <p className="mt-2 text-xl font-bold leading-none tracking-tight text-slate-900">
            {number(column.distinct)}
          </p>
          <p className="text-[11px] text-slate-500">
            distinct value{column.distinct === 1 ? "" : "s"}
          </p>
          {column.min !== undefined && (
            <p className="mt-2 truncate border-t border-slate-100 pt-2 text-[11px] tabular-nums text-slate-500">
              {number(column.min)} – {number(column.max)}
            </p>
          )}
        </>
      )}

      {role === "date" && (
        <>
          <p className="mt-2 text-sm font-bold leading-tight text-slate-900">{column.earliest}</p>
          <p className="text-[11px] text-slate-500">to {column.latest}</p>
        </>
      )}

      {/* One value across every row. It was drawn as a single bar at 100%,
          which is a chart of the fact that a filter worked. */}
      {role === "constant" && (
        <>
          <p
            className="mt-2 truncate text-sm font-bold leading-tight text-slate-900"
            title={column.value}
          >
            {column.value}
          </p>
          <p className="text-[11px] text-slate-500">the same on every row</p>
        </>
      )}

      {/* A different value on every row - a session key, a CNIC in a list of
          people. Four bars at 25% each said only that four rows are four rows. */}
      {role === "unique" && (
        <>
          <p className="mt-2 text-xl font-bold leading-none tracking-tight text-slate-900">
            {number(column.distinct)}
          </p>
          <p className="text-[11px] text-slate-500">all different</p>
        </>
      )}

      {role === "category" && (
        <>
          <p className="mt-2 text-xl font-bold leading-none tracking-tight text-slate-900">
            {number(column.distinct)}
          </p>
          <p className="text-[11px] text-slate-500">
            distinct value{column.distinct === 1 ? "" : "s"}
          </p>

          {column.top && column.top.length > 0 && (
            <div className="mt-2 space-y-1.5 border-t border-slate-100 pt-2">
              {column.top.map((entry) => (
                <Share
                  key={entry.value}
                  label={entry.value}
                  count={entry.count}
                  value={entry.count}
                  total={column.present || rowCount}
                />
              ))}
            </div>
          )}
        </>
      )}

      {column.missing > 0 && (
        <p className="mt-2 text-[11px] font-medium text-amber-700">
          {column.missing} missing
        </p>
      )}
    </div>
  );
};

const DataProfile: React.FC<{ profile?: AiProfile; title?: string }> = ({ profile, title }) => {
  // Collapsed by default past a handful, because a result twenty columns wide
  // would otherwise push the answer off the screen.
  const [expanded, setExpanded] = useState(false);

  if (!profile || profile.rowCount === 0 || profile.columns.length === 0) return null;

  const shown = expanded ? profile.columns : profile.columns.slice(0, 4);
  const hidden = profile.columns.length - shown.length;

  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center gap-2">
        <BarChart3 className="h-3.5 w-3.5 text-slate-400" />
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {title || "What this data contains"}
        </p>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          {profile.rowCount.toLocaleString()} row{profile.rowCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((column) => (
          <Card key={column.name} column={column} rowCount={profile.rowCount} />
        ))}
      </div>

      {hidden > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50"
        >
          <ChevronDown className="h-3.5 w-3.5" />
          {hidden} more column{hidden === 1 ? "" : "s"}
        </button>
      )}

      {expanded && profile.columns.length > 4 && (
        <button
          onClick={() => setExpanded(false)}
          className="mt-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100"
        >
          <ChevronDown className="h-3.5 w-3.5 rotate-180" />
          Show fewer
        </button>
      )}
    </div>
  );
};

export default DataProfile;
