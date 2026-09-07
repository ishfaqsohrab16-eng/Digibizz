/**
 * Tests for how a question is routed to a model.
 *
 * Run with:  node servec/providers/analyst.test.js
 * Exits non-zero if any rule regresses. No network, no keys.
 *
 * The routing exists for one measured reason: token allowances are per model,
 * per provider, and per minute. Everything tested here is about spending them
 * in the right order and not stopping when one runs out.
 */
process.env.CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY || "test-cerebras-key";
process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || "test-groq-key";

const path = require("path");

let passed = 0;
let failed = 0;

const check = (name, condition, detail) => {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? `  ->  ${detail}` : ""}`);
  }
};

const cerebras = require("./cerebras");
const groq = require("./groq");
const analyst = require("./analyst");

const { candidatesFor, estimateTokens } = analyst._internals;

console.log("\nReading the rate-limit headers\n");

// The reset headers use three different spellings and the wait is read from
// all of them. Getting this wrong means a model is treated as empty for the
// rest of the process, or as full when it is not.
const { parseDuration } = groq._internals;
check("seconds", parseDuration("30s") === 30);
check("minutes and seconds", parseDuration("1m30s") === 90);
check("a fractional minute", parseDuration("23m2.4s") === 1382.4);
check("milliseconds", parseDuration("5ms") === 0.005);
check("a bare number is seconds", parseDuration("12") === 12);
check("nonsense is not a wait", parseDuration("soon") === 0);
check("nothing is not a wait", parseDuration(undefined) === 0);

console.log("\nEstimating what a request costs\n");

const small = estimateTokens([{ role: "user", content: "hi" }], null);
const large = estimateTokens(
  [{ role: "user", content: "x".repeat(40000) }],
  [{ type: "function" }]
);
check("a small request is mostly the completion margin", small < 1300, String(small));
check("a large one is dominated by the prompt", large > 11000, String(large));
check("more text costs more", large > small);

console.log("\nChoosing which model answers\n");

const reset = () => {
  groq._internals.budgets.clear();
  cerebras._internals.budgets.clear();
};

reset();
let order = candidatesFor(3000);

// Cerebras is several times faster, so at equal headroom it goes first. This
// is the only reason the provider is preferred - not quality.
check(
  "Cerebras is tried before Groq when both are fresh",
  order[0]?.provider === "cerebras",
  order.slice(0, 3).map((entry) => `${entry.provider}/${entry.id}`).join(", ")
);
check(
  "and every model is a candidate, not just the first",
  order.length === cerebras.MODEL_IDS.length + groq.MODEL_IDS.length,
  String(order.length)
);

// The whole point of the change. A model that has spent its minute must not be
// asked again just to be told no - that is a wasted round trip on a question
// that is already slow.
reset();
cerebras._internals.noteBudget("gpt-oss-120b", {
  "x-ratelimit-remaining-tokens-minute": "100",
  "x-ratelimit-limit-tokens-minute": "60000",
  "x-ratelimit-reset-tokens-minute": "40s",
});
order = candidatesFor(3000);
check(
  "a model with no allowance left is not tried first",
  order[0]?.id !== "gpt-oss-120b",
  order.slice(0, 2).map((entry) => `${entry.provider}/${entry.id}`).join(", ")
);
check(
  "but it is still in the queue, in case the header was pessimistic",
  order.some((entry) => entry.id === "gpt-oss-120b")
);

// Per-model allowances are what make four Groq models worth having. Draining
// one must not move the others.
reset();
groq._internals.noteBudget("openai/gpt-oss-120b", {
  "x-ratelimit-remaining-tokens": "200",
  "x-ratelimit-limit-tokens": "8000",
  "x-ratelimit-reset-tokens": "50s",
});
check(
  "draining one Groq model leaves the others full",
  groq._internals.headroomFor("openai/gpt-oss-20b") === Infinity &&
    groq._internals.headroomFor("openai/gpt-oss-120b") === 200
);

const groqOrder = candidatesFor(3000).filter((entry) => entry.provider === "groq");
check(
  "and the drained one drops behind its siblings",
  groqOrder[groqOrder.length - 1]?.id === "openai/gpt-oss-120b",
  groqOrder.map((entry) => entry.id).join(", ")
);

// A reset time that has passed means the bucket refilled; treating the last
// reading as current would leave a model sidelined for the life of the process.
reset();
groq._internals.noteBudget("openai/gpt-oss-120b", {
  "x-ratelimit-remaining-tokens": "0",
  "x-ratelimit-limit-tokens": "8000",
  "x-ratelimit-reset-tokens": "0s",
});
check(
  "an expired reading is treated as a full bucket",
  groq._internals.headroomFor("openai/gpt-oss-120b") === Infinity
);

console.log("\nWhen a provider is not usable at all\n");

// The live Cerebras account answers 402 to every completion. That must stand
// the provider down and let Groq answer, not take the assistant down.
const { errorFor } = cerebras._internals;
const quota = errorFor(
  { status: 402, body: { message: "Payment required to access this resource." }, headers: {} },
  "gpt-oss-120b"
);
check("a 402 is recognised as a quota problem", quota.code === "NO_QUOTA");
check("and is retryable, so the next provider is tried", quota.retryable === true);
check("and says what Cerebras said", /Payment required/.test(quota.message), quota.message);

const badKey = errorFor({ status: 401, body: { message: "bad key" }, headers: {} }, "x");
check("a bad key is not retryable", badKey.retryable === false);
check("and names the variable to fix", /CEREBRAS_API_KEY/.test(badKey.message));

const busy = errorFor(
  { status: 429, body: { message: "slow down" }, headers: { "retry-after": "12" } },
  "gpt-oss-120b"
);
check("a 429 says how long the wait is", /12s/.test(busy.message), busy.message);
check("and is retryable", busy.retryable === true);

console.log("\nThe catalogue the panel is shown\n");

check("it lists both providers", analyst.CATALOGUE.some((entry) => entry.provider === "cerebras"));
check(
  "every entry has a label to show",
  analyst.CATALOGUE.every((entry) => entry.id && entry.label)
);
check(
  "the report covers every model",
  analyst.budgetReport().length === cerebras.MODEL_IDS.length + groq.MODEL_IDS.length,
  String(analyst.budgetReport().length)
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
