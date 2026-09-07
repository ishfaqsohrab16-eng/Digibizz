const https = require("https");
const { parseDuration } = require("./rateLimitHeaders");

/**
 * Talks to Cerebras.
 *
 * The same job as the Groq provider and the same OpenAI-compatible shape, kept
 * separate because the two accounts have separate allowances and the point of
 * having both is to spend them independently. servec/providers/analyst.js is
 * what decides between them.
 *
 * Cerebras runs its models on its own silicon and is markedly faster than
 * anything else here, which is why it is tried first. Its free tier is also
 * measured in tokens per minute, so it is not a way out of rate limiting - it
 * is a second, larger allowance to spend before the first one runs out.
 *
 * ONE DIFFERENCE WORTH KNOWING: alongside 429 for "too fast", Cerebras answers
 * 402 for "this account has no quota". That is not a transient failure and no
 * amount of waiting fixes it, but it must not take the assistant down either -
 * Groq is still there. So a 402 marks the whole provider unusable for a while
 * and the request goes on to Groq, with one line in the log saying why.
 */

const API_HOST = "api.cerebras.ai";
const CHAT_PATH = "/v1/chat/completions";
const MODELS_PATH = "/v1/models";

const API_KEY = process.env.CEREBRAS_API_KEY || "";

/**
 * The models offered, best first.
 *
 * Only models that can call tools are listed. The assistant works by calling
 * tools, and one that cannot would answer confidently without ever reading the
 * database - worse than one that refuses.
 */
const CHAT_MODELS = [
  {
    id: "gpt-oss-120b",
    label: "GPT-OSS 120B (Cerebras)",
    tagline: "Strongest, and the fastest of the three",
    speed: "instant",
    provider: "cerebras",
  },
  {
    id: "qwen-3.8-27b",
    label: "Qwen3.8 27B (Cerebras)",
    tagline: "Different training, so a useful second opinion",
    speed: "instant",
    provider: "cerebras",
  },
  {
    id: "gemma-4-31b",
    label: "Gemma 4 31B (Cerebras)",
    tagline: "The spare, for when the other two are spent",
    speed: "instant",
    provider: "cerebras",
  },
];

const MODEL_IDS = CHAT_MODELS.map((entry) => entry.id);

const TIMEOUT_MS = Number(process.env.CEREBRAS_TIMEOUT_MS) || 60000;
const MAX_COMPLETION_TOKENS = Number(process.env.AI_MAX_COMPLETION_TOKENS) || 800;

const isConfigured = Boolean(API_KEY);

/**
 * When the account itself is unusable, not just busy.
 *
 * Set by a 402. Re-checked occasionally rather than never, because the usual
 * cause is a billing tab nobody has opened yet and the fix happens outside this
 * process.
 */
const QUOTA_RECHECK_MS = Number(process.env.CEREBRAS_RECHECK_MS) || 10 * 60 * 1000;
let unusableUntil = 0;
let unusableReason = "";

class CerebrasError extends Error {
  constructor(message, { status, retryable, code } = {}) {
    super(message);
    this.name = "CerebrasError";
    this.status = status;
    this.code = code;
    this.retryable = Boolean(retryable);
  }
}

/** What is left of each model's minute, as the last response reported it. */
const budgets = new Map();

// Cerebras spells its rate-limit headers per window, and has changed the
// spelling before. Whichever is present is read.
const headerValue = (headers, names) => {
  for (const name of names) {
    const value = Number(headers[name]);
    if (Number.isFinite(value)) return value;
  }
  return null;
};

const noteBudget = (model, headers) => {
  const remaining = headerValue(headers, [
    "x-ratelimit-remaining-tokens-minute",
    "x-ratelimit-remaining-tokens",
  ]);
  if (remaining === null) return;

  const reset = parseDuration(
    headers["x-ratelimit-reset-tokens-minute"] || headers["x-ratelimit-reset-tokens"]
  );

  budgets.set(model, {
    remaining,
    limit: headerValue(headers, [
      "x-ratelimit-limit-tokens-minute",
      "x-ratelimit-limit-tokens",
    ]),
    freshUntil: Date.now() + (reset || 60) * 1000,
    at: Date.now(),
  });
};

/** How many tokens this model can be assumed to have. Unknown means full. */
const headroomFor = (model) => {
  if (!isConfigured || Date.now() < unusableUntil) return -1;
  const budget = budgets.get(model);
  if (!budget) return Infinity;
  if (Date.now() >= budget.freshUntil) return Infinity;
  return budget.remaining;
};

const budgetReport = () =>
  MODEL_IDS.map((id) => {
    const budget = budgets.get(id);
    const stale = !budget || Date.now() >= budget.freshUntil;
    return {
      provider: "cerebras",
      model: id,
      remaining: stale ? budget?.limit ?? null : budget.remaining,
      limit: budget?.limit ?? null,
      resetsIn: stale ? 0 : Math.ceil((budget.freshUntil - Date.now()) / 1000),
      unavailable: Date.now() < unusableUntil ? unusableReason : null,
    };
  });

/** One request, with a timeout that actually fires. */
const request = (path, payload) =>
  new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : null;

    const req = https.request(
      {
        host: API_HOST,
        path,
        method: payload ? "POST" : "GET",
        headers: {
          authorization: `Bearer ${API_KEY}`,
          accept: "application/json",
          ...(body
            ? {
                "content-type": "application/json",
                "content-length": Buffer.byteLength(body),
              }
            : {}),
        },
        timeout: TIMEOUT_MS,
      },
      (response) => {
        let raw = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          raw += chunk;
        });
        response.on("end", () => {
          let parsed = null;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch {
            parsed = { message: raw.slice(0, 400) };
          }
          resolve({
            status: response.statusCode,
            body: parsed,
            headers: response.headers,
          });
        });
      }
    );

    // A socket timeout does not reject on its own; without this the promise
    // never settles and the request hangs until the browser gives up.
    req.on("timeout", () => {
      req.destroy(
        new CerebrasError(
          `Cerebras did not answer within ${Math.round(TIMEOUT_MS / 1000)}s`,
          { retryable: true }
        )
      );
    });

    req.on("error", (error) => {
      reject(
        error instanceof CerebrasError
          ? error
          : new CerebrasError(`Could not reach Cerebras: ${error.message}`, {
              retryable: true,
            })
      );
    });

    if (body) req.write(body);
    req.end();
  });

/** Turn a non-2xx answer into an error that says what to do about it. */
const errorFor = ({ status, body, headers }, model) => {
  // Cerebras puts the message at the top level; some errors nest it as OpenAI
  // does. Both are read rather than reporting "no detail" for one of them.
  const detail = body?.message || body?.error?.message || "no detail";

  if (status === 401) {
    return new CerebrasError(
      `Cerebras rejected the API key. Check CEREBRAS_API_KEY. (${detail})`,
      { status, retryable: false, code: "BAD_KEY" }
    );
  }

  // The one that is neither a rate limit nor a fault: the account has no
  // credit or no free allowance. Nothing here can fix it, so the provider is
  // stood down and Groq answers instead.
  if (status === 402) {
    return new CerebrasError(
      `Cerebras will not serve this account: ${detail}`,
      { status, retryable: true, code: "NO_QUOTA" }
    );
  }

  if (status === 404) {
    return new CerebrasError(
      `Cerebras has no model called "${model}".`,
      { status, retryable: true, code: "NO_MODEL" }
    );
  }

  if (status === 429) {
    const wait = Math.ceil(parseDuration(headers?.["retry-after"]));
    return new CerebrasError(
      wait > 0
        ? `${model} has used its Cerebras allowance for now. It frees up in about ${wait}s.`
        : `${model} has used its Cerebras allowance for now.`,
      { status, retryable: true, code: "RATE_LIMITED" }
    );
  }

  if (status >= 500) {
    return new CerebrasError(`Cerebras is having a problem (${status}): ${detail}`, {
      status,
      retryable: true,
    });
  }

  return new CerebrasError(`Cerebras refused the request (${status}): ${detail}`, {
    status,
    retryable: false,
  });
};

/**
 * One turn of conversation, on one named model.
 *
 * Deliberately does NOT fall through to another model: choosing what to try
 * next is the router's job, because the next thing to try may be on the other
 * provider entirely.
 */
const chat = async (messages, { tools, toolChoice = "auto", temperature = 0, model }) => {
  if (!isConfigured) {
    throw new CerebrasError("CEREBRAS_API_KEY is not set", { retryable: true });
  }

  const response = await request(CHAT_PATH, {
    model,
    messages,
    max_completion_tokens: MAX_COMPLETION_TOKENS,
    // Zero: this writes SQL and reports numbers. Invention is not a feature.
    temperature,
    ...(tools ? { tools, tool_choice: toolChoice } : {}),
  });

  noteBudget(model, response.headers || {});

  if (response.status < 200 || response.status >= 300) {
    const error = errorFor(response, model);

    if (error.code === "NO_QUOTA" || error.code === "BAD_KEY") {
      // Stand the whole provider down rather than trying two more models that
      // will answer the same way.
      unusableUntil = Date.now() + QUOTA_RECHECK_MS;
      unusableReason = error.message;
      console.warn(
        `[ai] cerebras is unusable for the next ${Math.round(
          QUOTA_RECHECK_MS / 60000
        )} minutes: ${error.message}`
      );
    }

    throw error;
  }

  const choice = response.body?.choices?.[0];
  if (!choice?.message) {
    throw new CerebrasError("Cerebras returned no message", { retryable: true });
  }

  return {
    message: choice.message,
    finishReason: choice.finish_reason,
    model,
    provider: "cerebras",
    usage: response.body?.usage || null,
  };
};

/** Is the key good, and which of the catalogue can it reach? */
const health = async () => {
  if (!isConfigured) {
    return { ok: false, present: false, models: [], reason: "CEREBRAS_API_KEY is not set" };
  }

  const response = await request(MODELS_PATH);
  if (response.status < 200 || response.status >= 300) {
    throw errorFor(response, MODEL_IDS[0]);
  }

  const models = (response.body?.data || []).map((entry) => entry.id);

  return {
    ok: true,
    // Listing models proves the key, not the quota - a 402 account still lists
    // them happily. Whether it will actually answer is only known once it has
    // been asked, which is what unusableUntil records.
    present: models.some((id) => MODEL_IDS.includes(id)),
    usable: Date.now() >= unusableUntil,
    unavailable: Date.now() < unusableUntil ? unusableReason : null,
    catalogue: CHAT_MODELS.filter((entry) => models.includes(entry.id)),
    models,
  };
};

module.exports = {
  chat,
  health,
  budgetReport,
  headroomFor,
  isConfigured,
  CHAT_MODELS,
  MODEL_IDS,
  CerebrasError,
  _internals: { parseDuration, noteBudget, budgets, errorFor },
};
