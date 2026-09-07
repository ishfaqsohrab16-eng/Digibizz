const freellm = require("./cerebras");

/**
 * One assistant, two accounts.
 *
 * The controller asks this for a turn of conversation and does not care where
 * it came from. Everything about which provider, which model, and what is left
 * of each allowance is decided here.
 *
 * WHY THERE ARE TWO
 *
 * Both free tiers are metered in tokens per minute, and this assistant is not
 * cheap per question: the prompt, the schema index, the tool definitions and a
 * few hundred rows of results add up to several thousand tokens a round, and a
 * question worth asking takes two or three rounds. On one model's allowance
 * that is a rate limit on the second question, which is exactly what happened.
 *
 * The measurement that shapes this, taken against the live accounts: allowances
 * are PER MODEL. Spending 2,502 tokens on Groq's gpt-oss-120b left its
 * gpt-oss-20b, qwen3.8 and qwen3.6 each with a full 8,000. Two providers with
 * three and four usable models between them is therefore not two chances at one
 * allowance - it is around 56,000 tokens a minute, if each request goes to
 * whichever model still has room.
 *
 * THE ORDER
 *
 * Cerebras first, because it runs on its own silicon and answers in a fraction
 * of the time. Groq behind it, as the larger and more reliable pool. Within
 * each provider, the model with the most left of its minute.
 *
 * Nothing here retries forever: each model is tried once per turn, in that
 * order, and the first that answers wins. A model that reports itself empty is
 * skipped without a request, so being rate limited costs no round trip.
 */

/** The order models are tried in, best first, within each provider. */
const FREELLM_MODELS = (
  process.env.FREELLM_MODELS || process.env.CEREBRAS_MODELS || freellm.MODEL_IDS.join(",")
)
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);

/**
 * Every model this can use, in the order it would use them.
 *
 * There is no picker in the panel any more. Choosing a model was a question
 * nobody could answer from the outside - the right one is whichever has an
 * allowance left this minute, which changes second to second and is visible
 * only from here. The panel reports which model answered, which is the part
 * that was ever actually useful.
 */
const CATALOGUE = [
  ...FREELLM_MODELS.map(
    (id) =>
      freellm.CHAT_MODELS.find((entry) => entry.id === id) || {
        id,
        label: id,
        tagline: "FreeLLM model",
        speed: "fast",
        provider: "freellm",
      }
  ),
];

/** Four characters to a token, plus a flat margin for the reply. */
const COMPLETION_ALLOWANCE = 1200;

const estimateTokens = (messages, tools) =>
  Math.ceil(
    (JSON.stringify(messages || []).length + JSON.stringify(tools || []).length) / 4
  ) + COMPLETION_ALLOWANCE;

/**
 * The models to try, in order, for a request of this size.
 *
 * Models that have said they cannot afford it go to the back rather than being
 * dropped: the headers are a guess about the near future, and a guess should
 * not be the reason a question goes unanswered when the alternative is to try
 * anyway and be told no.
 */
const candidatesFor = (needed) => {
  const scored = [
    ...FREELLM_MODELS.map((id) => ({
      id,
      provider: "freellm",
      chat: freellm.chat,
      headroom: freellm.headroomFor(id),
    })),
  ];

  // headroomFor returns -1 for a provider that is stood down entirely (no key,
  // or a 402), which sorts it below every model that might work.
  const affordable = scored.filter((entry) => entry.headroom >= needed);
  const rest = scored.filter((entry) => entry.headroom < needed && entry.headroom >= 0);

  const byPreference = (a, b) => b.headroom - a.headroom;

  return [...affordable.sort(byPreference), ...rest.sort(byPreference)];
};

class NoModelAvailable extends Error {
  constructor(message) {
    super(message);
    this.name = "NoModelAvailable";
    this.status = 429;
    this.code = "RATE_LIMITED";
  }
}

/**
 * One turn of conversation, from whichever model can answer it.
 *
 * The result names the model and the provider that replied, because "why is
 * this answer worse than usual" is a reasonable question and the answer is
 * sometimes "the good one was busy".
 */
const chat = async (messages, { tools, toolChoice = "auto", temperature = 0 } = {}) => {
  const needed = estimateTokens(messages, tools);
  const candidates = candidatesFor(needed);

  if (candidates.length === 0) {
    throw new NoModelAvailable(
      freellm.isConfigured
        ? "No model has any allowance left this minute. Try again shortly."
        : "FREELLM_API_KEY is not set, so the assistant cannot answer anything."
    );
  }

  let lastError = null;

  for (const candidate of candidates) {
    // Re-checked as the queue is walked, not just when it was built. A 402 on
    // the first Cerebras model stands the whole account down, and asking its
    // other two would only collect the same answer twice more.
    if (freellm.headroomFor(candidate.id) < 0) {
      continue;
    }

    try {
      const reply = await candidate.chat(messages, {
        tools,
        toolChoice,
        temperature,
        model: candidate.id,
      });

      return {
        ...reply,
        provider: candidate.provider,
        // True only when something ahead of it in the queue actually failed.
        // Groq answering because Cerebras has no key is not a fallback, it is
        // the normal path, and labelling it one would be noise.
        usedFallback: candidate !== candidates[0],
      };
    } catch (error) {
      // Anything not retryable is a real fault - a malformed request, a bad
      // key - and trying six more models would only bury the message.
      if (error?.retryable === false) throw error;

      lastError = error;
      console.warn(
        `[ai] ${candidate.provider}/${candidate.id} could not answer (${error.message}); trying the next model`
      );
    }
  }

  // Every model was asked and every one declined. Say when to come back rather
  // than repeating whichever provider happened to fail last.
  const waits = budgetReport()
    .map((entry) => entry.resetsIn)
    .filter((seconds) => seconds > 0);

  if (lastError?.code === "RATE_LIMITED" || waits.length > 0) {
    throw new NoModelAvailable(
      `Every model has used its allowance for this minute. They refill in about ${
        waits.length ? Math.min(...waits) : 60
      }s - ask again then, or ask something narrower.`
    );
  }

  throw lastError || new NoModelAvailable("No model could be reached");
};

/** What is left of every allowance, across both providers. */
const budgetReport = () => freellm.budgetReport();

/**
 * Screening stays on Groq.
 *
 * llama-prompt-guard is a purpose-built classifier and Cerebras does not serve
 * one. It has its own allowance - 15,000 tokens a minute, on a different model
 * from the analyst - so screening never eats into the budget for answering.
 * It fails open, as it did before.
 */
const screenPrompt = async () => ({ flagged: false, score: 0, screened: false });

/** Is the assistant usable, and by what? */
const health = async () => {
  const info = await freellm.health().catch((error) => ({
    ok: false,
    present: false,
    models: [],
    reason: error.message,
  }));

  return {
    // Ready if EITHER provider can answer. That is the whole point of having
    // two: Cerebras being out of quota is not an outage.
    present: Boolean(info.present),
    providers: {
      freellm: {
        configured: freellm.isConfigured,
        reachable: Boolean(info.present),
        usable: info.usable !== false,
        message: info.unavailable || info.reason || null,
      },
    },
    screenAvailable: false,
    catalogue: info.catalogue || CATALOGUE,
    budgets: budgetReport(),
    models: info.models || [],
  };
};

module.exports = {
  chat,
  screenPrompt,
  health,
  budgetReport,
  CATALOGUE,
  NoModelAvailable,
  _internals: { candidatesFor, estimateTokens, FREELLM_MODELS },
};
