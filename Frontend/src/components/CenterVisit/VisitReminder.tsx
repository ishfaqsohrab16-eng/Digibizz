import React, { useEffect, useState } from "react";
import { ChevronRight, MapPinned } from "lucide-react";
import { getVisitsPending } from "../../services/api";

/**
 * The nudge on a Master Trainer's dashboard.
 *
 * Nothing at all when every centre has been visited. A card that is always
 * there is furniture; one that appears only when somewhere still needs
 * reaching is a reminder, and the difference is whether anyone reads it after
 * a month.
 *
 * Silent on failure. This is one card on a dashboard full of other work, and a
 * reminder that cannot load is not worth an error in the middle of somebody
 * else's screen.
 */

interface Props {
  onOpen: () => void;
}

const VisitReminder: React.FC<Props> = ({ onOpen }) => {
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let live = true;

    getVisitsPending()
      .then((data) => live && setPending(data.pending || 0))
      .catch(() => {
        /* A reminder that cannot load must not break the dashboard. */
      });

    return () => {
      live = false;
    };
  }, []);

  if (pending === 0) return null;

  return (
    <button
      onClick={onOpen}
      className="group flex w-full items-center gap-4 rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 to-indigo-50 p-4 text-left shadow-sm transition hover:border-sky-300 hover:shadow"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 ring-1 ring-inset ring-sky-200">
        <MapPinned className="h-5 w-5 text-sky-600" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-sky-900">
          {pending} centre{pending === 1 ? "" : "s"} still to visit this week
        </p>
        <p className="mt-0.5 text-xs text-sky-800">
          Fill in the Visit Report Proforma and attach photographs from the visit
        </p>
      </div>

      <ChevronRight className="h-5 w-5 shrink-0 text-sky-500 transition group-hover:translate-x-0.5" />
    </button>
  );
};

export default VisitReminder;
