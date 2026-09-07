import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  Copy,
  Database,
  GraduationCap,
  Loader2,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Table2,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  AiAnswer,
  AiQuery,
  AiStatus,
  askAiAssistant,
  getAiStatus,
} from "../../services/api";
import { useBatch } from "../../context/BatchContext";
import { isRole, ROLE } from "../../utils/roles";
import ResultVisual from "./ResultVisual";
import DataProfile from "./DataProfile";
import AnswerText from "./AnswerText";

interface Turn {
  id: number;
  question: string;
  answer: AiAnswer | null;
  error: string | null;
  /** Seconds this question took, kept so it does not reset when others run. */
  seconds: number;
}

/**
 * Questions worth starting from.
 *
 * A blank box invites "hello". These are real questions about real tables, and
 * grouped so the categories themselves say what the assistant can reach.
 */
const SUGGESTIONS = [
  {
    icon: Users,
    label: "Enrolment",
    text: "How many students are enrolled at each centre in the current batch?",
  },
  {
    icon: BarChart3,
    label: "Gender split",
    text: "Compare male and female enrolment across centres",
  },
  {
    icon: TrendingUp,
    label: "Applications over time",
    text: "Show applications per month this year as a line chart",
  },
  {
    icon: GraduationCap,
    label: "Interview outcomes",
    text: "Which courses have the most applicants who were not recommended?",
  },
  {
    icon: Table2,
    label: "Assignments",
    text: "Which centres have the lowest assignment submission rates?",
  },
  {
    icon: Database,
    label: "Funnel",
    text: "Show the funnel from applied to recommended to enrolled for this batch",
  },
];

/**
 * The result worth profiling.
 *
 * A question runs several queries and most of them are orientation - the
 * distinct values of a column, a row count, five rows to check a join. Their
 * statistics are noise. The one people want to see the shape of is the biggest
 * result the answer drew a visual from, falling back to the biggest overall.
 */
const largestQuery = (answer: AiAnswer): AiQuery | undefined => {
  const charted = answer.visuals
    .map((visual) => answer.queries[visual.queryIndex])
    .filter(Boolean);

  const candidates = charted.length > 0 ? charted : answer.queries;

  return candidates.reduce<AiQuery | undefined>(
    (best, query) => (!best || query.rowCount > best.rowCount ? query : best),
    undefined
  );
};

/**
 * Ask questions about the programme's data in plain English.
 *
 * Super Admin only, and the server enforces the same on every endpoint.
 *
 * The model writes SQL but never touches the database directly: every statement
 * is checked by utils/sqlGuard.js and runs as an account holding only SELECT.
 * The SQL is shown under every answer, because an answer about your own data
 * that you cannot check is worth very little.
 */
const AiAssistantPanel: React.FC = () => {
  const { userType } = useBatch();
  const canUse = isRole(userType, ROLE.SUPER_ADMIN);

  const [status, setStatus] = useState<AiStatus | null>(null);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [asking, setAsking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [openSql, setOpenSql] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nextId = useRef(1);

  /**
   * Identifies this train of thought to the server, so data fetched for one
   * question can answer the next without querying again. Held for the life of
   * the tab; reloading starts a fresh conversation, which is what a reload
   * should mean.
   */
  const conversationId = useMemo(
    () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  const loadStatus = useCallback(() => {
    getAiStatus()
      .then(setStatus)
      .catch(() =>
        setStatus({
          success: false,
          ready: false,
          readOnlyAccount: false,
          message: "Could not check whether the assistant is available.",
        })
      );
  }, []);

  useEffect(() => {
    if (canUse) loadStatus();
  }, [canUse, loadStatus]);

  /** A running count while a question is out, so waiting never looks like hanging. */
  useEffect(() => {
    if (!asking) return;
    setElapsed(0);
    const started = Date.now();
    const timer = window.setInterval(
      () => setElapsed(Math.round((Date.now() - started) / 1000)),
      1000
    );
    return () => window.clearInterval(timer);
  }, [asking]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, asking]);

  const copy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(key);
        window.setTimeout(() => setCopied(null), 1500);
      },
      () => toast.error("Could not copy")
    );
  };

  const ask = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || asking) return;

      const id = nextId.current++;
      const startedAt = Date.now();

      setTurns((previous) => [
        ...previous,
        { id, question: trimmed, answer: null, error: null, seconds: 0 },
      ]);
      setQuestion("");
      setAsking(true);

      try {
        // Only questions and summaries travel as history. The ROWS stay on the
        // server against the conversation id - sending them back would refill
        // the model's context with data it has already read and crowd out the
        // schema, which is what keeps its SQL correct.
        const history = turns.flatMap((turn) =>
          turn.answer
            ? [
                { role: "user" as const, content: turn.question },
                { role: "assistant" as const, content: turn.answer.summary },
              ]
            : []
        );

        const answer = await askAiAssistant(trimmed, history, conversationId);
        setTurns((previous) =>
          previous.map((turn) =>
            turn.id === id
              ? { ...turn, answer, seconds: Math.round((Date.now() - startedAt) / 1000) }
              : turn
          )
        );
      } catch (error: any) {
        const message =
          error?.response?.data?.message ||
          (error?.code === "ECONNABORTED"
            ? "That took longer than the assistant is allowed to wait. Try a narrower question."
            : "Could not reach the assistant.");

        setTurns((previous) =>
          previous.map((turn) =>
            turn.id === id
              ? { ...turn, error: message, seconds: Math.round((Date.now() - startedAt) / 1000) }
              : turn
          )
        );
        toast.error(message);
      } finally {
        setAsking(false);
        inputRef.current?.focus();
      }
    },
    [asking, turns, conversationId]
  );

  if (!canUse) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
          <ShieldAlert className="mx-auto h-9 w-9 text-amber-600" />
          <h2 className="mt-3 text-lg font-semibold text-amber-900">
            Super Admin only
          </h2>
          <p className="mt-1.5 text-sm text-amber-800">
            This assistant answers across every centre, batch and student with no
            scoping by role, so it is limited to Super Admins.
          </p>
        </div>
      </div>
    );
  }

  const blocked = !status?.ready;
  const routerModels = status?.routerModels || 0;

  return (
    // Fills the viewport under the app chrome and manages its own scrolling, so
    // the composer stays put while a long answer scrolls behind it.
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-slate-50">
      <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-sm">
              <Sparkles className="h-5 w-5 text-white" />
            </span>
            <div>
              <h1 className="text-lg font-semibold leading-tight text-slate-900">
                Ask the data
              </h1>
              <p className="text-xs text-slate-500">
                Students, applications, centres, attendance, assignments, earnings
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {status?.readOnlyAccount && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200"
                title="Queries run as a database account that only holds SELECT"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Read-only
              </span>
            )}

            {/* Not a picker. Which model to use is not a question anyone can
                answer from here: it is whichever of the router's models is
                free this minute AND can call tools, which only the router
                knows. What is worth showing is how many it has to choose
                between, because that is what makes a busy minute survivable. */}
            {routerModels > 0 && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200"
                title="Each question goes to whichever free model is available and able to query the database. The one that answered is shown under the answer."
              >
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                {routerModels} models
              </span>
            )}

            {turns.length > 0 && (
              <button
                onClick={() => {
                  setTurns([]);
                  setOpenSql({});
                }}
                disabled={asking}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                New chat
              </button>
            )}
          </div>
        </div>
      </header>

      {(blocked || (status?.ready && !status.readOnlyAccount)) && (
        <div className="shrink-0 px-4 pt-3 sm:px-6">
          <div className="mx-auto max-w-6xl">
            {blocked && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">The assistant is not available yet.</p>
                  <p className="mt-0.5">{status?.message}</p>
                </div>
                <button
                  onClick={loadStatus}
                  className="shrink-0 rounded-lg border border-amber-300 px-2.5 py-1 text-xs font-medium hover:bg-amber-100"
                >
                  Re-check
                </button>
              </div>
            )}

            {status?.ready && !status.readOnlyAccount && (
              <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3.5 text-xs text-slate-600">
                <Database className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Running on the application's own database connection. Queries are
                  limited to SELECT by the query guard; setting{" "}
                  <code className="rounded bg-slate-100 px-1">AI_DB_USER</code> to a
                  SELECT-only account would enforce it at the database instead.
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-6xl">
          {turns.length === 0 && (
            <div className="py-8">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-slate-800">
                  What would you like to know?
                </h2>
                <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
                  Ask in plain English. It looks at the data before answering, and
                  follow-ups reuse what it already fetched — so “show that as a
                  table” is instant.
                </p>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {SUGGESTIONS.map((suggestion) => {
                  const Icon = suggestion.icon;
                  return (
                    <button
                      key={suggestion.label}
                      onClick={() => ask(suggestion.text)}
                      disabled={asking || blocked}
                      className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
                        <Icon className="h-4.5 w-4.5" />
                      </span>
                      <span className="mt-3 block text-xs font-semibold uppercase tracking-wide text-emerald-700">
                        {suggestion.label}
                      </span>
                      <span className="mt-1 block text-sm leading-snug text-slate-600">
                        {suggestion.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {turns.map((turn) => (
            <div key={turn.id} className="mb-8">
              <div className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-emerald-600 to-emerald-700 px-4 py-2.5 text-sm text-white shadow-sm">
                  {turn.question}
                </p>
              </div>

              {turn.error && (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  {turn.error}
                </div>
              )}

              {!turn.answer && !turn.error && (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-600 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                  <span>
                    Looking at the data
                    <span className="ml-2 tabular-nums text-slate-400">{elapsed}s</span>
                  </span>
                </div>
              )}

              {turn.answer && (
                <div className="mt-3">
                  <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-5 py-4 shadow-sm">
                    <AnswerText text={turn.answer.summary} />
                  </div>

                  {turn.answer.visuals.map((visual, index) => (
                    <ResultVisual
                      key={index}
                      visual={visual}
                      query={turn.answer!.queries[visual.queryIndex]}
                    />
                  ))}

                  {/* The statistics behind the answer, for the dataset the
                      answer actually leans on. Shown for the largest result
                      rather than for every query, because the orienting
                      queries - "what are the distinct values of this column"
                      - have nothing worth profiling. */}
                  <DataProfile profile={largestQuery(turn.answer)?.profile} />

                  {turn.answer.queries.length > 0 && (
                    <div className="mt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() =>
                            setOpenSql((previous) => ({
                              ...previous,
                              [turn.id]: !previous[turn.id],
                            }))
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-200/60 hover:text-slate-700"
                        >
                          <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform ${
                              openSql[turn.id] ? "rotate-180" : ""
                            }`}
                          />
                          <Table2 className="h-3.5 w-3.5" />
                          {turn.answer.queries.length}{" "}
                          {turn.answer.queries.length === 1 ? "dataset" : "datasets"} ·{" "}
                          {turn.seconds}s
                        </button>

                        {turn.answer.model && (
                          <span
                            className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[11px] text-slate-600"
                            title="The model the router picked for this question, and the provider it reached it through"
                          >
                            {turn.answer.model.split("/").pop()}
                            {/* Which account, now that there are two. "Why is
                                this answer worse than usual" is sometimes "the
                                fast one was busy". */}
                            {turn.answer.provider &&
                              ` · ${turn.answer.provider.split(":").pop()}`}
                          </span>
                        )}
                      </div>

                      {openSql[turn.id] && (
                        <div className="mt-2 space-y-2">
                          {turn.answer.queries.map((query, index) => (
                            <div
                              key={index}
                              className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900"
                            >
                              <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-3 py-2">
                                <p className="text-xs text-slate-400">
                                  <span className="mr-1.5 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-emerald-400">
                                    {index}
                                  </span>
                                  {query.reason || "query"}
                                </p>
                                <button
                                  onClick={() => copy(query.sql, `${turn.id}-${index}`)}
                                  className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
                                  title="Copy SQL"
                                >
                                  {copied === `${turn.id}-${index}` ? (
                                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                              <pre className="overflow-x-auto whitespace-pre-wrap break-words px-3 py-2.5 font-mono text-xs leading-relaxed text-emerald-300">
                                {query.sql}
                              </pre>
                              <p className="border-t border-slate-800 px-3 py-1.5 text-xs text-slate-500">
                                {query.rowCount} row(s) · {query.ms}ms
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          <div ref={endRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            ask(question);
          }}
          className="mx-auto flex max-w-6xl items-end gap-2"
        >
          <textarea
            ref={inputRef}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends, Shift+Enter is a newline: the convention every chat
              // box uses, and the one people try first.
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                ask(question);
              }
            }}
            rows={1}
            disabled={asking || blocked}
            placeholder={
              blocked
                ? "The assistant is not available"
                : turns.length > 0
                ? "Ask a follow-up…"
                : "Ask anything about the programme's data…"
            }
            className="max-h-40 min-h-[48px] flex-1 resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
          />
          <button
            type="submit"
            disabled={asking || !question.trim() || blocked}
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {asking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {asking ? `${elapsed}s` : "Ask"}
          </button>
        </form>
        <p className="mx-auto mt-2 max-w-6xl text-center text-[11px] text-slate-400">
          Reads the database only — it can never change anything. Every query it
          ran is shown under the answer, and any table can be downloaded as Excel.
        </p>
      </div>
    </div>
  );
};

export default AiAssistantPanel;
