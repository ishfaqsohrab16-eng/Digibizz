import React from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { EvalWeek } from "../../services/api";

/**
 * Which week is being reported on.
 *
 * Weeks are the axis of this whole module, so moving between them has to be
 * one click rather than a dropdown hunt - an MT catching up on a fortnight
 * steps backwards twice, and the arrows do that.
 *
 * The dropdown is still there for a jump further back, and every option spells
 * out its dates. "2026-W37" means nothing to anyone; "7 Sep – 11 Sep" is the
 * week they remember being at the centre.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "7 Sep – 11 Sep 2026", collapsing the month when both ends share one. */
export const describeWeek = (week: EvalWeek) => {
  const [, startMonth, startDay] = week.start.split("-");
  const [endYear, endMonth, endDay] = week.end.split("-");

  const from = `${Number(startDay)} ${MONTHS[Number(startMonth) - 1]}`;
  const to = `${Number(endDay)} ${MONTHS[Number(endMonth) - 1]}`;

  return startMonth === endMonth
    ? `${Number(startDay)} – ${to} ${endYear}`
    : `${from} – ${to} ${endYear}`;
};

interface Props {
  week: EvalWeek;
  weeks: EvalWeek[];
  onChange: (key: string) => void;
  disabled?: boolean;
}

const WeekPicker: React.FC<Props> = ({ week, weeks, onChange, disabled }) => {
  const index = weeks.findIndex((entry) => entry.key === week.key);

  // weeks[] is newest first, so "older" is forwards through the array and
  // "newer" is backwards. Getting this the wrong way round is the easiest
  // mistake here and the least obvious once shipped.
  const older = index >= 0 && index < weeks.length - 1 ? weeks[index + 1] : null;
  const newer = index > 0 ? weeks[index - 1] : null;

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      <button
        type="button"
        disabled={disabled || !older}
        onClick={() => older && onChange(older.key)}
        aria-label="Previous week"
        className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="relative flex items-center gap-2 px-2">
        <CalendarDays className="h-4 w-4 shrink-0 text-emerald-600" />
        <select
          value={week.key}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="cursor-pointer appearance-none bg-transparent pr-4 text-sm font-semibold text-slate-800 focus:outline-none"
        >
          {weeks.map((entry, position) => (
            <option key={entry.key} value={entry.key}>
              {describeWeek(entry)}
              {position === 0 ? " · this week" : ""}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        disabled={disabled || !newer}
        onClick={() => newer && onChange(newer.key)}
        aria-label="Next week"
        className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
};

export default WeekPicker;
