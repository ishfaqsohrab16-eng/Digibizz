import React, { useEffect, useState } from "react";
import { CalendarClock, ChevronRight } from "lucide-react";
import { getEvaluationsPending } from "../../services/api";
import { describeWeek } from "./WeekPicker";

/**
 * The nudge on a Master Trainer's dashboard.
 *
 * Shows nothing at all when there is nothing outstanding. A card that is
 * always present is furniture; one that appears only when something is owed is
 * a reminder, and the difference is whether anyone still reads it after a
 * month.
 *
 * Silent on failure too. This is one card on a dashboard full of other work -
 * a reminder that cannot load is not worth an error message in the middle of
 * someone else's screen.
 */

interface Props {
  onOpen: () => void;
}

const EvaluationReminder: React.FC<Props> = ({ onOpen }) => {
  const [pending, setPending] = useState<Array<{ week: any; outstanding: number }>>([]);

  useEffect(() => {
    let live = true;

    getEvaluationsPending()
      .then((data) => live && setPending(data.pending || []))
      .catch(() => {
        /* A reminder that cannot load must not break the dashboard. */
      });

    return () => {
      live = false;
    };
  }, []);

  if (pending.length === 0) return null;

  const total = pending.reduce((sum, entry) => sum + entry.outstanding, 0);
  // Oldest first: the week most at risk of being forgotten is the one to name.
  const oldest = pending[pending.length - 1];

  return (
    <button
      onClick={onOpen}
      className="group flex w-full items-center gap-4 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 text-left shadow-sm transition hover:border-amber-300 hover:shadow"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-inset ring-amber-200">
        <CalendarClock className="h-5 w-5 text-amber-600" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-amber-900">
          {total} weekly M&amp;E report{total === 1 ? "" : "s"} still to submit
        </p>
        <p className="mt-0.5 text-xs text-amber-800">
          {pending.length === 1
            ? `For ${describeWeek(pending[0].week)}`
            : `Oldest outstanding: ${describeWeek(oldest.week)}`}
          {" · "}
          Most of the figures are filled in for you
        </p>
      </div>

      <ChevronRight className="h-5 w-5 shrink-0 text-amber-500 transition group-hover:translate-x-0.5" />
    </button>
  );
};

export default EvaluationReminder;
