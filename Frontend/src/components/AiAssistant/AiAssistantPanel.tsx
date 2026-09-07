import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  Database,
  Loader2,
  Send,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  AiAnswer,
  AiStatus,
  askAiAssistant,
  getAiStatus,
} from "../../services/api";
import { useBatch } from "../../context/BatchContext";
import { isRole, ROLE } from "../../utils/roles";
import ResultVisual from "./ResultVisual";

/** One exchange in the conversation. */
interface Turn {
  id: number;
  question: string;
  answer: AiAnswer | null;
  error: string | null;
}

/**
 * Questions worth starting from.
 *
 * A blank box invites "hello", which wastes a slow round trip and teaches the
 * person nothing about what the assistant can do. These are real questions
 * about real tables.
 */
const SUGGESTIONS = [
  "How many students are enrolled in each centre, in the current batch?",
  "Show applications per month this year as a line chart",
  "Which courses have the most applicants who were not recommended?",
  "Compare male and female enrolment across centres",
  "Which centres have assignments with the lowest submission rates?",
  "List the students with no attendance marked in the last two weeks",
];

/**
 * Ask questions about the programme's data in plain English.
 *
 * Super Admin only, and the server enforces the same on every endpoint - this
 * check only decides whether the screen is worth rendering.
 *
 * The model writes SQL, but it never touches the database directly: every
 * statement is checked against utils/sqlGuard.js and, when the deployment is
 * set up properly, runs as an account that only holds SELECT. The SQL it ran is
 * shown under each answer, because an answer about your own data that you
 * cannot check is worth very little.
 */
const AiAssistantPanel: React.FC = () => {
  const { userType } = useBatch();
  const canUse = isRole(userType, ROLE.SUPER_ADMIN);

  const [status, setStatus] = useState<AiStatus | null>(null);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [asking, setAsking] = useState(false);
  const [openSql, setOpenSql] = useState<Record<string, boolean>>({});

  const endRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    if (!canUse) return;
    getAiStatus()
      .then(setStatus)
      .catch(() =>
        setStatus({
          success: false,
          ready: false,
          model: "",
          url: "",
          readOnlyAccount: false,
          message: "Could not check whether the assistant is available.",
        })
      );
  }, [canUse]);

  // Follow the conversation as it grows, so the newest answer is in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, asking]);

  const ask = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || asking) return;

      const id = nextId.current++;
      setTurns((previous) => [
        ...previous,
        { id, question: trimmed, answer: null, error: null },
      ]);
      setQuestion("");
      setAsking(true);

      try {
        // Only the question and the summary go back as history. Sending the
        // rows too would refill the model's context with data it has already
        // read and crowd out the schema, which is what keeps the SQL correct.
        const history = turns.flatMap((turn) =>
          turn.answer
            ? [
                { role: "user" as const, content: turn.question },
                { role: "assistant" as const, content: turn.answer.summary },
              ]
            : []
        );

        const answer = await askAiAssistant(trimmed, history);
        setTurns((previous) =>
          previous.map((turn) => (turn.id === id ? { ...turn, answer } : turn))
        );
      } catch (error: any) {
        const message =
          error?.response?.data?.message ||
          (error?.code === "ECONNABORTED"
            ? "The model took too long to answer. Try a narrower question."
            : "Could not reach the assistant.");

        setTurns((previous) =>
          previous.map((turn) => (turn.id === id ? { ...turn, error: message } : turn))
        );
        toast.error(message);
      } finally {
        setAsking(false);
      }
    },
    [asking, turns]
  );

  if (!canUse) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-md rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-amber-600" />
          <h2 className="mt-3 text-lg font-semibold text-amber-900">
            Super Admin only
          </h2>
          <p className="mt-1 text-sm text-amber-800">
            This assistant answers across every centre, batch and student with no
            scoping by role, so it is limited to Super Admins.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto flex h-[calc(100vh-8rem)] max-w-5xl flex-col px-4 py-6">
      <header className="mb-4">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Sparkles className="h-6 w-6 text-emerald-600" />
          Ask the data
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Ask about students, applications, centres, attendance, assignments or
          earnings in plain English. The assistant reads the database — it can
          never change anything in it.
        </p>
      </header>

      {/* What is wrong, if anything, said before the first question rather than
          after it fails. */}
      {status && !status.ready && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">The assistant is not available yet.</p>
            <p className="mt-0.5">{status.message}</p>
          </div>
        </div>
      )}

      {status?.ready && !status.readOnlyAccount && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <Database className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Running on the application's own database connection. Queries are
            limited to SELECT by the query guard; setting{" "}
            <code className="rounded bg-slate-200 px-1">AI_DB_USER</code> to a
            SELECT-only account would enforce it at the database instead.
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
        {turns.length === 0 && (
          <div className="py-6">
            <p className="text-sm font-medium text-slate-700">
              Try one of these:
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => ask(suggestion)}
                  disabled={asking || !status?.ready}
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn) => (
          <div key={turn.id} className="mb-6">
            <div className="flex justify-end">
              <p className="max-w-[80%] rounded-2xl rounded-br-sm bg-emerald-600 px-4 py-2 text-sm text-white">
                {turn.question}
              </p>
            </div>

            {turn.error && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                {turn.error}
              </div>
            )}

            {!turn.answer && !turn.error && (
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Working it out — this can take a moment.
              </div>
            )}

            {turn.answer && (
              <div className="mt-3">
                <p className="whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-sm">
                  {turn.answer.summary}
                </p>

                {turn.answer.visuals.map((visual, index) => (
                  <ResultVisual
                    key={index}
                    visual={visual}
                    query={turn.answer!.queries[visual.queryIndex]}
                  />
                ))}

                {/* The SQL it ran. Collapsed, but always there: an answer about
                    your own data that you cannot check is worth very little. */}
                {turn.answer.queries.length > 0 && (
                  <div className="mt-3">
                    <button
                      onClick={() =>
                        setOpenSql((previous) => ({
                          ...previous,
                          [turn.id]: !previous[turn.id],
                        }))
                      }
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
                    >
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${
                          openSql[turn.id] ? "rotate-180" : ""
                        }`}
                      />
                      {turn.answer.queries.length}{" "}
                      {turn.answer.queries.length === 1 ? "query" : "queries"} ·{" "}
                      {turn.answer.ms}ms
                    </button>

                    {openSql[turn.id] && (
                      <div className="mt-2 space-y-2">
                        {turn.answer.queries.map((query, index) => (
                          <div
                            key={index}
                            className="rounded-md border border-slate-200 bg-white p-3"
                          >
                            {query.reason && (
                              <p className="mb-1 text-xs text-slate-500">
                                {query.reason}
                              </p>
                            )}
                            <pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-700">
                              {query.sql}
                            </pre>
                            <p className="mt-1 text-xs text-slate-400">
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

      <form
        onSubmit={(event) => {
          event.preventDefault();
          ask(question);
        }}
        className="mt-3 flex items-end gap-2"
      >
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter is a newline - the convention every
            // chat box uses, and the one people will try first.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              ask(question);
            }
          }}
          rows={2}
          disabled={asking || !status?.ready}
          placeholder={
            status?.ready
              ? "Ask anything about the programme's data…"
              : "The assistant is not available"
          }
          className="flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 disabled:bg-slate-100"
        />
        <button
          type="submit"
          disabled={asking || !question.trim() || !status?.ready}
          className="inline-flex h-[42px] items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {asking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Ask
        </button>
      </form>
    </div>
  );
};

export default AiAssistantPanel;
