const {
  chat,
  screenPrompt,
  health,
  ANALYST_MODEL,
  SCREEN_MODEL,
  CHAT_MODELS,
  resolveModel,
  isConfigured,
  GroqError,
} = require("../servec/providers/groq");
const { checkSelect, MAX_ROWS } = require("../utils/sqlGuard");
const { describeSchema } = require("../utils/dbSchema");
const { runQuery, hasOwnAccount, missingPassword } = require("../utils/aiReadOnlyDb");
const { datasetsFor, remember } = require("../utils/aiConversations");

/**
 * The data assistant.
 *
 * A Super Admin asks a question in English; the model asks for the data it
 * needs; the guard decides whether each query may run; the rows come back; the
 * model reads them and says what they mean, choosing tables and charts to suit.
 *
 * Built on TOOL CALLING rather than on asking the model to emit a JSON
 * protocol. The protocol version worked, but every reply had to be recovered
 * from markdown fences and explanatory sentences the model had been told not to
 * write. With tools the shape is enforced by the API: a tool call is a tool
 * call, and `finish_reason` says unambiguously which branch was taken.
 *
 * Four things shape the design:
 *
 *   The model is never trusted with the database. Every statement goes through
 *   utils/sqlGuard.js and runs as an account that only holds SELECT.
 *
 *   The question is screened for prompt injection before the analyst sees it.
 *
 *   The model is never trusted with the presentation either. It proposes a
 *   chart; this checks the fields it named exist in the rows.
 *
 *   Everything it did comes back with the answer - the SQL, the row counts,
 *   the timings, which model answered. An answer about your own data that you
 *   cannot check is worth very little.
 */

/** How many tool rounds before the assistant must answer with what it has. */
const MAX_ROUNDS = Number(process.env.AI_MAX_ROUNDS) || 8;

/** Conversation turns kept as context. */
const MAX_HISTORY = 12;

/**
 * Rows fed back to the model per query.
 *
 * Raised from 60 now that the analyst carries 131k tokens of context. The old
 * limit was sized for a local 8B model and was throwing away detail these
 * models can comfortably read and reason over.
 */
const ROWS_SHOWN_TO_MODEL = 150;

/**
 * The tools the analyst may call.
 *
 * Two, deliberately. Anything else it might want - more rows, a different
 * grain, a different join - is another SELECT, and giving it exactly one way to
 * reach the database keeps the guard the only door.
 */
const TOOLS = [
  {
    type: "function",
    function: {
      name: "run_sql",
      description:
        "Run one read-only MySQL SELECT against the LMS database and get the rows back. " +
        "Call this as many times as you need, and call it again with a better query if " +
        "the first result does not answer the question.",
      parameters: {
        type: "object",
        properties: {
          sql: {
            type: "string",
            description:
              "A single SELECT statement. No semicolons in the middle, no comments, " +
              "no writes of any kind. Alias every aggregate. Join to return readable " +
              "names (center_name, course_name, tb_name) rather than ids.",
          },
          reason: {
            type: "string",
            description: "What this query tells you, in a few words.",
          },
        },
        required: ["sql", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "present_answer",
      description:
        "Give the final answer once you have the data. Call this exactly once, last.",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description:
              "Plain text for someone who has not seen the numbers. Lead with the " +
              "answer, then the notable detail, with the actual figures in it. Never " +
              'say "the query returned"; say what is true about the programme.',
          },
          visuals: {
            type: "array",
            description:
              "How to show the data. May be empty. Each entry points at a dataset by " +
              "index: 0 is the first result available to you, and results carried over " +
              "from earlier in the conversation keep their original indices.",
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: [
                    "stat",
                    "table",
                    "list",
                    "bar",
                    "hbar",
                    "stackedBar",
                    "line",
                    "area",
                    "pie",
                    "donut",
                    "scatter",
                    "radar",
                    "radial",
                    "treemap",
                    "funnel",
                  ],
                  description:
                    "stat: one headline number. table: detail read row by row. " +
                    "list: a short ranked list. bar: a breakdown across categories. " +
                    "hbar: the same when labels are long, like centre names. " +
                    "stackedBar: parts of a whole across categories. line or area: " +
                    "anything over time. pie or donut: shares of one total, up to " +
                    "about six slices. scatter: two numbers against each other. " +
                    "radar: several measures compared across a few subjects. " +
                    "radial: progress towards a target. treemap: relative size " +
                    "across many categories. funnel: stages that narrow, like " +
                    "applied to interviewed to enrolled.",
                },
                title: { type: "string" },
                queryIndex: { type: "integer" },
                valueField: { type: "string", description: "stat and pie" },
                labelField: { type: "string", description: "pie" },
                xField: { type: "string", description: "bar, line, area" },
                yFields: {
                  type: "array",
                  items: { type: "string" },
                  description: "bar, line, area - one entry per series",
                },
              },
              required: ["type", "title", "queryIndex"],
            },
          },
        },
        required: ["summary"],
      },
    },
  },
];

const SYSTEM_PROMPT = `You are the data assistant for the Digibizz LMS, a digital skills training programme run across centres in Balochistan, Pakistan.

You answer questions about the programme by querying its MySQL database with the run_sql tool, then explaining what you found with present_answer.

WORK OUT WHAT IS BEING ASKED BEFORE YOU QUERY
Read the question for what the person wants to know, not for keywords.
- "compare X and Y" needs both, in one result, side by side, so they can be charted together.
- "top", "best", "worst" need ORDER BY and LIMIT.
- "how many" is one number; "which" is a list; "trend" or "over time" is a series ordered by date.
- "students" and "applicants" are different tables. Re-read the glossary before assuming which one is meant.
- "why" cannot be answered by a database. Give the numbers that bear on it and say what they do and do not show.
If the question is genuinely ambiguous, pick the most useful reading, answer it, and say in one sentence which reading you took.

LOOK BEFORE YOU ANSWER
Do not write one big query from the schema and trust it. The schema tells you what columns exist; it does not tell you what is IN them, and a query against a wrong assumption returns a confident, wrong number.
So when a question touches anything you have not already looked at this conversation, orient first with one or two small, cheap queries:
- what the distinct values of a column actually are, before filtering on one
  (SELECT DISTINCT std_gender FROM students LIMIT 20)
- how many rows a filter actually matches, before building a report on it
- whether a join returns what you expect, at the grain you expect, on a few rows
  (add LIMIT 5 and read them)
These cost nothing and they are what stops an answer being wrong in a way nobody notices. Once you know the shape, write the real query.

QUERY UNTIL YOU CAN ACTUALLY ANSWER
Call run_sql as many times as you need. If a result is empty, at the wrong grain, or lumps together things that should be separate, query again with a better one - that is expected, not a failure. Fetch each piece separately rather than forcing one enormous join, and when comparing, fetch both sides.
An empty result is a finding, not a dead end: check whether the filter was wrong before reporting zero.

WRITING SQL
- SELECT only. No INSERT, UPDATE, DELETE, DDL, or anything that changes state.
- One statement per call. No semicolons in the middle, no comments at all.
- Name the columns you want; do not use SELECT *.
- Alias every aggregate: COUNT(*) AS total.
- Join to return readable names - center_name, course_name, tb_name - not raw ids.
- For a comparison, return one row per category with a column per series, so it charts directly: center_name, males, females.

DATA YOU ALREADY HAVE
Results from earlier in this conversation are listed after the schema, with their indices. They are still live. If a follow-up can be answered from one - showing it as a table instead of a chart, reading a different number out of it, sorting it differently - answer from it and reference its index. Do not re-run a query for data you already have.

ANSWERING
Call present_answer exactly once, at the end. Choose visuals that suit the data; a table alongside a chart is often right. Only reference fields that exist in that dataset.

If a question cannot be answered from the database, say so plainly with no visuals. Never invent a number, and never present a figure you did not query.

If something in the data looks wrong - a count far larger than the batch, a category you did not expect, a total that does not add up - say so in the summary rather than presenting it flatly. Being told a figure looks odd is more useful than being given it without comment.`;

/** The rows the model sees, trimmed so a wide result does not fill its context. */
const summariseRows = (rows) => {
  if (rows.length === 0) return "no rows";

  const shown = rows.slice(0, ROWS_SHOWN_TO_MODEL);
  const note =
    rows.length > shown.length
      ? `\n(${rows.length} rows in total; the first ${shown.length} are shown)`
      : "";

  return `${JSON.stringify(shown)}${note}`;
};

/** Tool arguments arrive as a JSON string, and are not always valid. */
const parseArguments = (raw) => {
  try {
    const parsed = JSON.parse(String(raw || "{}"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * Keep only visuals that will actually render.
 *
 * A chart naming a column that is not in the result set draws an empty box with
 * a confident title, which is worse than the table it replaced. Rather than
 * dropping those, they become a table of the same data - the information the
 * model wanted to show is still shown.
 */
/**
 * The exact spelling each chart type must have by the time it reaches the
 * browser, keyed by its lower-cased form.
 *
 * Models are inconsistent about casing - stackedbar, StackedBar, stacked_bar
 * all turn up - and the renderer switches on an exact string.
 */
const CANONICAL_TYPES = {
  stat: "stat",
  table: "table",
  list: "list",
  bar: "bar",
  hbar: "hbar",
  horizontalbar: "hbar",
  stackedbar: "stackedBar",
  stacked_bar: "stackedBar",
  line: "line",
  area: "area",
  pie: "pie",
  donut: "donut",
  doughnut: "donut",
  scatter: "scatter",
  radar: "radar",
  radial: "radial",
  treemap: "treemap",
  funnel: "funnel",
};

const repairVisuals = (visuals, results) => {
  if (!Array.isArray(visuals)) return [];

  const kept = [];

  for (const visual of visuals) {
    if (!visual || typeof visual !== "object") continue;

    const index = Number(visual.queryIndex);
    const result = results[index];
    if (!result || result.rows.length === 0) continue;

    const columns = Object.keys(result.rows[0] || {});
    const has = (field) => Boolean(field) && columns.includes(field);
    const title = String(visual.title || "").slice(0, 120);

    // Matched case-insensitively, then mapped back to the exact name the
    // renderer expects. Comparing the lower-cased value directly turned
    // "stackedBar" into "stackedbar", which matched nothing and quietly
    // demoted every stacked bar chart to a table.
    const type = CANONICAL_TYPES[String(visual.type || "table").toLowerCase()] || "table";

    const asTable = { type: "table", title, queryIndex: index };

    if (type === "table") {
      kept.push(asTable);
      continue;
    }

    if (type === "stat") {
      const valueField = has(visual.valueField) ? visual.valueField : columns[0];
      kept.push({ type: "stat", title, queryIndex: index, valueField });
      continue;
    }

    if (type === "pie" || type === "donut") {
      if (has(visual.labelField) && has(visual.valueField)) {
        kept.push({
          type,
          title,
          queryIndex: index,
          labelField: visual.labelField,
          valueField: visual.valueField,
        });
      } else {
        kept.push(asTable);
      }
      continue;
    }

    // Same shape as a pie: one label, one number.
    if (type === "treemap" || type === "funnel" || type === "radial" || type === "list") {
      const labelField = has(visual.labelField) ? visual.labelField : columns[0];
      const valueField = has(visual.valueField) ? visual.valueField : columns[1];
      if (labelField && valueField) {
        kept.push({ type, title, queryIndex: index, labelField, valueField });
      } else {
        kept.push(asTable);
      }
      continue;
    }

    if (type === "scatter") {
      const yFields = (Array.isArray(visual.yFields) ? visual.yFields : [visual.yField])
        .filter(has);
      if (has(visual.xField) && yFields.length > 0) {
        kept.push({
          type,
          title,
          queryIndex: index,
          xField: visual.xField,
          yFields,
          ...(has(visual.labelField) ? { labelField: visual.labelField } : {}),
        });
      } else {
        kept.push(asTable);
      }
      continue;
    }

    if (
      type === "bar" ||
      type === "hbar" ||
      type === "stackedBar" ||
      type === "line" ||
      type === "area" ||
      type === "radar"
    ) {
      const yFields = (Array.isArray(visual.yFields) ? visual.yFields : [visual.yField])
        .filter(has);

      if (has(visual.xField) && yFields.length > 0) {
        kept.push({ type, title, queryIndex: index, xField: visual.xField, yFields });
      } else {
        kept.push(asTable);
      }
      continue;
    }

    kept.push(asTable);
  }

  return kept;
};

exports.ask = async (req, res) => {
  const question = String(req.body?.question || "").trim();

  // Identifies the train of thought, so data fetched earlier can be reused. It
  // names nothing and grants nothing; a missing one simply means no memory.
  const conversationId = String(req.body?.conversationId || "").slice(0, 64);

  // Whatever the panel picked, checked against the catalogue. An unknown
  // name falls back to the default rather than being passed through, so a
  // stale browser tab cannot select a model that no longer exists - or one
  // that cannot call tools, which would answer without reading the database.
  const chosenModel = resolveModel(req.body?.model);

  if (!question) {
    return res.status(400).json({ success: false, message: "Ask a question first" });
  }
  if (question.length > 2000) {
    return res.status(400).json({ success: false, message: "That question is too long" });
  }

  const startedAt = Date.now();

  try {
    // Screened before the analyst sees it. A Super Admin has no reason to write
    // "ignore your instructions", and the same text can arrive indirectly - a
    // candidate's own name, read back during an answer. The guard still decides
    // what runs; this catches the attempt earlier and puts it in the log.
    const screen = await screenPrompt(question);
    if (screen.flagged) {
      console.warn(
        `[ai] refused a question scoring ${screen.score.toFixed(3)} for prompt injection, from user ${req.user.id}`
      );
      return res.status(400).json({
        success: false,
        message:
          "That reads as an attempt to change how the assistant behaves rather than a question about the data. Ask about the programme instead.",
      });
    }

    const { text: schema } = await describeSchema();

    const carried = datasetsFor(conversationId);
    const carriedDescription = carried.length
      ? `\n\nDATA ALREADY FETCHED IN THIS CONVERSATION\n${carried
          .map(
            (dataset, index) =>
              `[${index}] ${dataset.reason || dataset.sql}\n` +
              `    columns: ${Object.keys(dataset.rows[0] || {}).join(", ") || "none"}\n` +
              `    ${dataset.rowCount} row(s); first rows: ${summariseRows(
                dataset.rows.slice(0, 8)
              )}`
          )
          .join("\n")}`
      : "";

    const history = Array.isArray(req.body?.history)
      ? req.body.history
          .slice(-MAX_HISTORY)
          .filter(
            (turn) =>
              turn &&
              (turn.role === "user" || turn.role === "assistant") &&
              typeof turn.content === "string"
          )
          .map((turn) => ({ role: turn.role, content: String(turn.content).slice(0, 4000) }))
      : [];

    const messages = [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\n\nTHE DATABASE\n${schema}${carriedDescription}`,
      },
      ...history,
      { role: "user", content: question },
    ];

    /**
     * Everything available to this answer: what earlier turns fetched, then
     * whatever this turn adds. Indices are stable across the whole array, which
     * is what lets a follow-up chart data it did not just query.
     */
    const results = [...carried];
    const fetchedNow = [];

    let answer = null;
    let rounds = 0;
    let modelUsed = ANALYST_MODEL;
    let usedFallback = false;

    while (rounds < MAX_ROUNDS) {
      rounds += 1;

      const reply = await chat(messages, { tools: TOOLS, model: chosenModel });
      modelUsed = reply.model;
      usedFallback = usedFallback || reply.usedFallback;

      const calls = reply.message.tool_calls || [];

      if (calls.length === 0) {
        // No tool call. Either it answered in prose - which is usable - or it
        // has nothing to say. Either way the loop is over.
        const content = String(reply.message.content || "").trim();
        if (content) answer = { summary: content, visuals: [] };
        break;
      }

      messages.push(reply.message);

      let presented = false;

      // Several calls can arrive at once, which is exactly what a question
      // needing two independent figures should do.
      for (const call of calls) {
        const name = call.function?.name;
        const args = parseArguments(call.function?.arguments);

        if (!args) {
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: "Those arguments were not valid JSON. Try again.",
          });
          continue;
        }

        if (name === "present_answer") {
          answer = args;
          presented = true;
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: "Answer delivered.",
          });
          continue;
        }

        if (name !== "run_sql") {
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: `Unknown tool "${name}". Use run_sql or present_answer.`,
          });
          continue;
        }

        const verdict = checkSelect(args.sql);

        if (!verdict.ok) {
          // Refusals go back to the model rather than ending the request: it
          // usually rewrites the query correctly, and an operator does not care
          // that the first attempt used a reserved word.
          console.warn(
            `[ai] refused a query: ${verdict.reason} | ${String(args.sql).slice(0, 200)}`
          );
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: `Refused: ${verdict.reason}. Rewrite it as a single read-only SELECT.`,
          });
          continue;
        }

        try {
          const { rows, ms } = await runQuery(verdict.sql);

          const dataset = {
            sql: verdict.sql,
            reason: String(args.reason || "").slice(0, 300),
            rowCount: rows.length,
            ms,
            rows,
          };
          results.push(dataset);
          fetchedNow.push(dataset);

          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: `Dataset ${results.length - 1}: ${summariseRows(rows)}`,
          });
        } catch (error) {
          // A failed query is information too - usually a column that does not
          // exist, which the model can correct from the message.
          console.warn(`[ai] query failed: ${error.message}`);
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: `That query failed: ${String(error.message).slice(
              0,
              300
            )}. Check the names against the schema and try again.`,
          });
        }
      }

      if (presented) break;
    }

    // Only what this turn fetched is added; the carried datasets are already
    // remembered and re-storing them would push out the rest.
    remember(conversationId, fetchedNow);

    if (!answer) {
      return res.status(200).json({
        success: true,
        answered: false,
        summary:
          results.length > 0
            ? "I found some data but could not turn it into an answer. The queries I ran are below."
            : "I could not work out how to answer that from the database. Try asking it a different way, or more specifically.",
        visuals: [],
        queries: results,
        rounds,
        model: modelUsed,
        usedFallback,
        ms: Date.now() - startedAt,
      });
    }

    const visuals = repairVisuals(answer.visuals, results);

    console.log(
      `[ai] "${question.slice(0, 80)}" answered in ${rounds} round(s), ` +
        `${fetchedNow.length} new quer(ies), ${Date.now() - startedAt}ms, ` +
        `by ${modelUsed}${usedFallback ? " (fallback)" : ""}, user ${req.user.id}`
    );

    return res.json({
      success: true,
      answered: true,
      summary: String(answer.summary || "").slice(0, 8000),
      visuals,
      queries: results,
      rounds,
      model: modelUsed,
      usedFallback,
      ms: Date.now() - startedAt,
    });
  } catch (error) {
    if (error instanceof GroqError) {
      console.error("[ai] groq:", error.message);
      return res.status(503).json({ success: false, message: error.message });
    }

    console.error("[ai] assistant failed:", error);
    return res.status(500).json({
      success: false,
      message: "The assistant could not answer that",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Is the assistant usable?
 *
 * Called when the panel opens, so the answer to "why is nothing happening" is
 * on the screen rather than in a log file.
 */
exports.status = async (_req, res) => {
  const base = {
    success: true,
    model: ANALYST_MODEL,
    provider: "groq",
    readOnlyAccount: hasOwnAccount,
  };

  if (!isConfigured) {
    return res.json({
      ...base,
      ready: false,
      catalogue: CHAT_MODELS,
      message: "GROQ_API_KEY is not set. Add it to the environment and restart.",
    });
  }

  if (missingPassword) {
    return res.json({
      ...base,
      ready: false,
      message:
        "AI_DB_USER is set but AI_DB_PASSWORD is empty. Set the password for that database account, or remove both variables.",
    });
  }

  try {
    const info = await health();
    const schema = await describeSchema();

    return res.json({
      ...base,
      ready: info.present,
      screening: info.screenAvailable ? SCREEN_MODEL : null,
      fallbacks: info.fallbacks,
      // Only models this key can reach AND that can call tools.
      catalogue: info.catalogue,
      tables: schema.tables.length,
      maxRows: MAX_ROWS,
      message: info.present
        ? null
        : `Your Groq key cannot use "${ANALYST_MODEL}". Available: ${info.models
            .slice(0, 8)
            .join(", ")}`,
    });
  } catch (error) {
    return res.json({
      ...base,
      ready: false,
      message: error instanceof GroqError ? error.message : "Could not reach Groq",
    });
  }
};

exports._internals = { parseArguments, repairVisuals, summariseRows, TOOLS, SYSTEM_PROMPT };
