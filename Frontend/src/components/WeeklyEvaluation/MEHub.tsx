import React, { useState } from "react";
import { Building2, Globe } from "lucide-react";
import OnlineReports from "../OnlineClassReport/OnlineReports";

/**
 * The Weekly M&E Reports module, which now has two forms in it.
 *
 * PHYSICAL CENTRES are reported per trainer - the existing weekly report on
 * trainer performance. ONLINE AND HYBRID CENTRES are reported per centre, on
 * the Online Classes Report. The two are different forms for different
 * situations rather than one form with parts to skip, and a centre appears in
 * exactly one of them.
 *
 * `physical` is whichever physical-centre screen fits the viewer - a Master
 * Trainer's own trainers, or an admin's overview - so this only adds the
 * choice between the two and leaves both screens as they were.
 */

type Tab = "physical" | "online";

const STORAGE_KEY = "me-reports-tab";

const remembered = (): Tab => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "online" ? "online" : "physical";
  } catch {
    return "physical";
  }
};

const MEHub: React.FC<{ physical: React.ReactNode }> = ({ physical }) => {
  const [tab, setTab] = useState<Tab>(remembered);

  const choose = (next: Tab) => {
    setTab(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private browsing: the choice is simply not remembered */
    }
  };

  const tabs: Array<{ key: Tab; title: string; detail: string; Icon: typeof Globe }> = [
    { key: "physical", title: "Physical centres", detail: "Report on each trainer", Icon: Building2 },
    { key: "online", title: "Online & hybrid centres", detail: "One report per centre", Icon: Globe },
  ];

  return (
    <div>
      <div className="mx-auto mb-5 max-w-5xl">
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1">
          {tabs.map(({ key, title, detail, Icon }) => {
            const on = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => choose(key)}
                className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-left transition ${
                  on ? "bg-white shadow-sm ring-1 ring-slate-200" : "hover:bg-white/60"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${on ? "text-emerald-600" : "text-slate-400"}`} />
                <span className="min-w-0">
                  <span
                    className={`block truncate text-sm font-semibold ${
                      on ? "text-slate-900" : "text-slate-600"
                    }`}
                  >
                    {title}
                  </span>
                  <span className="block truncate text-[11px] text-slate-500">{detail}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {tab === "physical" ? physical : <OnlineReports />}
    </div>
  );
};

export default MEHub;
