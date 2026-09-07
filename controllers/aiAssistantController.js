const { chat, health, MODEL, BASE_URL, OllamaError } = require("../servec/providers/ollama");
const { checkSelect, MAX_ROWS } = require("../utils/sqlGuard");
const { describeSchema } = require("../utils/dbSchema");
const { runQuery, hasOwnAccount } = require("../utils/aiReadOnlyDb");

/**
 * The data assistant.
 *
 * A Super Admin asks a question in English; the model writes SQL; the guard
 * decides whether it may run; the rows come back; the model reads them and
 * says what they mean. It may take several turns - most real questions need
 * more than one query, and comparing two numbers means fetching both.
 *
 * Three things shape the design:
 *
 *   The model is never trusted with the database. Every statement goes through
 *   utils/sqlGuard.js, and ideally runs as an account that only holds SELECT.
 *
 *   The model is never trusted with the presentation either. It proposes a
 *   chart; this checks the fields it named actually exist in the rows and
 *   falls back to a table when they do not, because a chart of a column that
 *   is not there renders as an empty box with a title.
 *
 *   Everything it did is returned alongside the answer - the SQL, the row
 *   counts, the timings. An answer about your own data that you cannot check
 *   is worth very little.
 */

/** How many query rounds before the assistant must answer with what it has. */
const MAX_ROUNDS = Number(process.env.AI_MAX_ROUNDS) || 6;

/** Conversation turns kept as context. Older ones are dropped. */
const MAX_HISTORY = 12;

/** Rows fed back to the model per query. It reasons over these, not over 500. */
const ROWS_SHOWN_TO_MODEL = 60;

const SYSTEM_PROMPT = `You are the data assistant for the Digibizz LMS, a training programme in Balochistan, Pakistan.

You answer questions about the programme by querying its MySQL database and explaining what you find.

HOW YOU WORK
You reply with ONE JSON object and nothing else. No prose outside it, no markdown fences.

To look something up:
{"action":"query","sql":"SELECT ...","reason":"what this tells you"}

To answer, once you have what you need:
{"action":"answer","summary":"...","visuals":[...]}

You may query several times before answering. Use that: fetch each piece
separately rather than forcing one enormous join, and compare numbers by
fetching both.

RULES FOR SQL
- SELECT only. No INSERT, UPDATE, DELETE, DDL, or anything that changes state.
- One statement per query. No semicolons in the middle, no comments at all.
- Name the columns you want. Avoid SELECT *.
- Always alias aggregates: COUNT(*) AS total, not COUNT(*).
- Add ORDER BY when order is meaningful, and LIMIT when a question implies "top".
- Prefer readable names over ids in the output: join to get center_name,
  course_name, tb_name rather than returning center_id.

WRITING THE ANSWER
"summary" is plain text for a person who has not seen the numbers. Lead with
the answer, then the notable detail. Never say "the query returned"; say what
is true about the programme. Include the actual figures.

"visuals" is a list, and may be empty. Each entry points at one of your query
results by its index (0 for your first query, 1 for the second, and so on):

{"type":"stat","title":"Enrolled students","queryIndex":0,"valueField":"total"}
{"type":"table","title":"By centre","queryIndex":1}
{"type":"bar","title":"Students per centre","queryIndex":1,"xField":"center_name","yFields":["students"]}
{"type":"line","title":"Applications by month","queryIndex":2,"xField":"month","yFields":["applications"]}
{"type":"pie","title":"Gender split","queryIndex":3,"labelField":"std_gender","valueField":"total"}

Choose the form that suits the data: a single number is a stat, a breakdown
across categories is a bar or pie, anything over time is a line, and detail
that people will read row by row is a table. A table alongside a chart is
often right. Only reference fields that exist in that query's results.

If a question cannot be answered from the database, say so plainly in an
answer with no visuals. Do not invent numbers, and never present a figure you
did not query.`;

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

/**
 * Pull the JSON object out of whatever the model actually said.
 *
 * Asked for JSON and told not to wrap it, models still return fenced blocks and
 * add a sentence of introduction. Recovering the object is cheaper than
 * spending a round telling it off.
 */
const parseReply = (raw) => {
  const text = String(raw || "").trim();

  const attempts = [
    text,
    // ```json ... ```
    text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""),
    // The first {...} in a sentence.
    (() => {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      return start >= 0 && end > start ? text.slice(start, end + 1) : "";
    })(),
  ];

  for (const attempt of attempts) {
    if (!attempt) continue;
    try {
      const parsed = JSON.parse(attempt);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // Try the next shape.
    }
  }
  return null;
};

/**
 * Keep only visuals that will actually render.
 *
 * A chart naming a column that is not in the result set draws an empty box with
 * a confident title, which is worse than the table it replaced. Rather than
 * dropping those, they become a table of the same data - the information the
 * model wanted to show is still shown.
 */
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
    const type = String(visual.type || "table").toLowerCase();

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

    if (type === "pie") {
      if (has(visual.labelField) && has(visual.valueField)) {
        kept.push({
          type: "pie",
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

    if (type === "bar" || type === "line" || type === "area") {
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

/**
 * Ask a question.
 *
 * The whole exchange happens inside this one request: the model is called,
 * queried, and called again until it answers or runs out of rounds. That keeps
 * the browser holding one connection instead of polling, and means the
 * transcript the client sends back is only ever question-and-answer.
 */
exports.ask = async (req, res) => {
  const question = String(req.body?.question || "").trim();

  if (!question) {
    return res
      .status(400)
      .json({ success: false, message: "Ask a question first" });
  }
  if (question.length > 2000) {
    return res
      .status(400)
      .json({ success: false, message: "That question is too long" });
  }

  const startedAt = Date.now();

  try {
    const { text: schema } = await describeSchema();

    // Prior turns, so follow-up questions work. Trimmed to the recent ones -
    // a long transcript crowds out the schema, and the schema is what makes
    // the SQL correct.
    const history = Array.isArray(req.body?.history)
      ? req.body.history
          .slice(-MAX_HISTORY)
          .filter(
            (turn) =>
              turn &&
              (turn.role === "user" || turn.role === "assistant") &&
              typeof turn.content === "string"
          )
          .map((turn) => ({
            role: turn.role,
            content: String(turn.content).slice(0, 4000),
          }))
      : [];

    const messages = [
      { role: "system", content: `${SYSTEM_PROMPT}\n\nTHE DATABASE\n${schema}` },
      ...history,
      { role: "user", content: question },
    ];

    /** Everything actually run, in order, returned to the caller. */
    const results = [];
    let answer = null;
    let rounds = 0;

    while (rounds < MAX_ROUNDS) {
      rounds += 1;

      const raw = await chat(messages, { json: true });
      const reply = parseReply(raw);

      if (!reply) {
        messages.push({ role: "assistant", content: raw });
        messages.push({
          role: "user",
          content:
            'That was not valid JSON. Reply with a single JSON object: {"action":"query",...} or {"action":"answer",...}',
        });
        continue;
      }

      if (reply.action === "answer") {
        answer = reply;
        break;
      }

      if (reply.action !== "query" || !reply.sql) {
        messages.push({ role: "assistant", content: JSON.stringify(reply) });
        messages.push({
          role: "user",
          content:
            'Unrecognised action. Use {"action":"query","sql":"..."} or {"action":"answer","summary":"...","visuals":[]}',
        });
        continue;
      }

      const verdict = checkSelect(reply.sql);

      if (!verdict.ok) {
        // Refusals go back to the model rather than ending the request: it
        // usually rewrites the query correctly, and an operator does not care
        // that the first attempt used a reserved word.
        console.warn(
          `[ai] refused a query from the model: ${verdict.reason} | ${String(reply.sql).slice(0, 200)}`
        );
        messages.push({ role: "assistant", content: JSON.stringify(reply) });
        messages.push({
          role: "user",
          content: `That query was refused: ${verdict.reason}. Rewrite it as a single read-only SELECT.`,
        });
        continue;
      }

      try {
        const { rows, ms } = await runQuery(verdict.sql);

        results.push({
          sql: verdict.sql,
          reason: String(reply.reason || "").slice(0, 300),
          rowCount: rows.length,
          ms,
          rows,
        });

        messages.push({ role: "assistant", content: JSON.stringify(reply) });
        messages.push({
          role: "user",
          content: `Result of query ${results.length - 1}: ${summariseRows(rows)}`,
        });
      } catch (error) {
        // A query that fails is information too - usually a column that does
        // not exist, which the model can correct from the message.
        console.warn(`[ai] query failed: ${error.message}`);
        messages.push({ role: "assistant", content: JSON.stringify(reply) });
        messages.push({
          role: "user",
          content: `That query failed: ${String(error.message).slice(0, 300)}. Check the column and table names against the schema and try again.`,
        });
      }
    }

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
        ms: Date.now() - startedAt,
      });
    }

    const visuals = repairVisuals(answer.visuals, results);

    console.log(
      `[ai] "${question.slice(0, 80)}" answered in ${rounds} round(s), ` +
        `${results.length} quer(ies), ${Date.now() - startedAt}ms, by user ${req.user.id}`
    );

    return res.json({
      success: true,
      answered: true,
      summary: String(answer.summary || "").slice(0, 8000),
      visuals,
      queries: results,
      rounds,
      ms: Date.now() - startedAt,
    });
  } catch (error) {
    if (error instanceof OllamaError) {
      console.error("[ai] ollama:", error.message);
      return res.status(503).json({
        success: false,
        message: error.message,
      });
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
  try {
    const info = await health();
    const schema = await describeSchema();

    return res.json({
      success: true,
      ready: info.present,
      model: MODEL,
      url: BASE_URL,
      readOnlyAccount: hasOwnAccount,
      tables: schema.tables.length,
      maxRows: MAX_ROWS,
      message: info.present
        ? null
        : `Ollama is running but has no model called "${MODEL}". Run: ollama pull ${MODEL}`,
    });
  } catch (error) {
    return res.status(200).json({
      success: true,
      ready: false,
      model: MODEL,
      url: BASE_URL,
      readOnlyAccount: hasOwnAccount,
      message:
        error instanceof OllamaError
          ? error.message
          : `Could not reach Ollama at ${BASE_URL}`,
    });
  }
};

exports._internals = { parseReply, repairVisuals, summariseRows, SYSTEM_PROMPT };
