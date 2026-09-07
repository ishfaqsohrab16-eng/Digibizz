/**
 * Tests for how the assistant talks to the FreeLLM router.
 *
 * Run with:  node servec/providers/freellm.test.js
 * Exits non-zero if any rule regresses. No network, no keys.
 *
 * Every case here is a response shape observed against the live router, and
 * most of them are ones that previously turned into "the assistant is broken"
 * when they meant something specific and fixable.
 */
process.env.FREELLM_API_KEY = process.env.FREELLM_API_KEY || "test-key";

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

const freellm = require("./freellm");
const { errorFor, noteQuota, quotaState, RETRY_ONCE } = freellm._internals;

console.log("\nReading the router's own rate limit\n");

// NOT the shape the upstream providers use. The router counts REQUESTS in a
// window and resets at an absolute unix timestamp; reading those headers as
// "tokens remaining this minute" is how the tracking silently did nothing.
const inTwoMinutes = Math.floor(Date.now() / 1000) + 120;
noteQuota({
  "x-ratelimit-limit": "120",
  "x-ratelimit-remaining": "118",
  "x-ratelimit-reset": String(inTwoMinutes),
});

check("the limit is read", quotaState().limit === 120);
check("what is left is read", quotaState().remaining === 118);
check(
  "the reset is an absolute timestamp, not a duration",
  Math.abs(freellm.secondsUntilReset() - 120) <= 1,
  String(freellm.secondsUntilReset())
);
check("and it is reported in requests, not tokens", freellm.quotaReport().unit === "requests");

// A window that has already rolled over is not a wait.
noteQuota({
  "x-ratelimit-limit": "120",
  "x-ratelimit-remaining": "0",
  "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) - 5),
});
check("an elapsed window is no wait at all", freellm.secondsUntilReset() === 0);

// Headers the router did not send must not overwrite what is known with NaN.
const before = quotaState().limit;
noteQuota({});
check("a response with no rate-limit headers changes nothing", quotaState().limit === before);

console.log("\nWhat each failure means\n");

// The one that matters day to day. The router tried every provider it could
// and they were all rate limited or cooling down.
noteQuota({
  "x-ratelimit-limit": "120",
  "x-ratelimit-remaining": "0",
  "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 45),
});
const exhausted = errorFor({
  status: 429,
  body: { error: { message: "All models exhausted: 6 routes checked (6 rate-limited or on cooldown)." } },
  headers: {},
});
check("429 is recognised as exhausted capacity", exhausted.code === "EXHAUSTED");
check("and is retryable", exhausted.retryable === true);
check("and says roughly how long to wait", /45s/.test(exhausted.message), exhausted.message);
check(
  "and keeps the router's own words, which say how many routes it tried",
  /6 routes checked/.test(exhausted.message),
  exhausted.message
);

// Two clocks: the router's request window, and the upstream provider's limit.
// Quoting ours alongside theirs produced "about 61s" next to "reset ~39s" in
// the same sentence, so theirs wins whenever they give one.
const bothClocks = errorFor({
  status: 429,
  body: {
    error: {
      message: "All models exhausted: 318 routes checked (8 rate-limited or on cooldown). Soonest reset ~39s.",
    },
  },
  headers: {},
});
check(
  "the router's own reset estimate is not contradicted with ours",
  !/about \d+s/.test(bothClocks.message),
  bothClocks.message
);
check("and its estimate survives", /~39s/.test(bothClocks.message));

console.log("\nWaiting for capacity instead of giving up\n");

// The failure that keeps reaching the screen. "Soonest reset ~16s" is not a
// dead end, it is a sixteen-second wait, and showing someone an error when the
// answer was twenty seconds away is the wrong trade. Reading that number is
// what makes the difference, so it is read in every unit the router uses.
const { parseSoonestReset } = freellm._internals;
check("seconds are read", parseSoonestReset("Soonest reset ~16s.") === 16);
check("a bare form without the tilde", parseSoonestReset("Soonest reset 45s") === 45);
check("minutes become seconds", parseSoonestReset("Soonest reset ~5m.") === 300);
check("hours become seconds", parseSoonestReset("Soonest reset ~24h.") === 86400);
check("milliseconds", parseSoonestReset("Soonest reset ~500ms") === 0.5);
check("no estimate is null, not zero", parseSoonestReset("All models exhausted.") === null);
check("nothing at all is null", parseSoonestReset(undefined) === null);

// A short wait is carried on the error so the caller can act on it; a daily
// limit is carried too, and it is the size that decides, not the presence.
const shortWait = errorFor({
  status: 429,
  body: { error: { message: "All models exhausted: 318 routes checked. Soonest reset ~16s." } },
  headers: {},
});
check("a 16s wait is offered to the caller", shortWait.retryAfterMs === 16000);

const dayWait = errorFor({
  status: 429,
  body: { error: { message: "All models exhausted: 318 routes checked. Soonest reset ~24h." } },
  headers: {},
});
check(
  "a 24h wait is far past anything worth sitting through",
  dayWait.retryAfterMs === 86400000
);
check(
  "and both still say what the router said",
  /~24h/.test(dayWait.message) && /~16s/.test(shortWait.message)
);

// The decision itself. Pure, and tested here rather than against the live
// router, because the wait it offers is whatever its providers happen to be
// doing that second - in three runs it said 16s, 89s and 10m.
const { waitFor, MAX_WAIT_MS } = freellm._internals;
const now = 1_000_000;
const plenty = now + 100000;

check(
  "a 16s reset is waited out rather than failed",
  waitFor(shortWait, plenty, now) === 17000,
  String(waitFor(shortWait, plenty, now))
);
check("a 24h reset is not", waitFor(dayWait, plenty, now) === 0);

const tenMinutes = errorFor({
  status: 429,
  body: { error: { message: "All models exhausted. Soonest reset ~10m." } },
  headers: {},
});
check("nor is the 10m one seen live", waitFor(tenMinutes, plenty, now) === 0);

// The bound that stops eight rounds of waiting outlasting the browser. With
// only ten seconds of budget left, a sixteen-second wait must be refused even
// though it is otherwise short enough.
check(
  "a wait that would run past the question's deadline is refused",
  waitFor(shortWait, now + 10000, now) === 0
);
check(
  "and one that fits is allowed",
  waitFor(shortWait, now + 30000, now) === 17000
);
check("no deadline means only the cap applies", waitFor(shortWait, undefined, now) === 17000);
check(
  "the cap is the outer bound",
  waitFor(
    errorFor({
      status: 429,
      body: { error: { message: `Soonest reset ~${Math.round(MAX_WAIT_MS / 1000) + 5}s.` } },
      headers: {},
    }),
    plenty,
    now
  ) === 0
);

// Only exhausted capacity is waited for. A garbled tool call should be asked
// again immediately, not slept on.
check("other failures are not waited for", waitFor(badToolPlaceholder(), plenty, now) === 0);

function badToolPlaceholder() {
  return errorFor({
    status: 400,
    body: { error: { message: "Failed to parse tool call arguments as JSON" } },
    headers: {},
  });
}

// A 404 means two different things and they need different messages. This one
// is a provider withdrawing a model between the router's catalog sync and the
// request - seen live, while asking for "auto". Telling someone to unset a
// variable they never set is worse than saying nothing, and it is not their
// mistake to fix: asking again picks a different route.
const stale = errorFor({
  status: 404,
  body: {
    error: {
      message: "Every routed provider reports the model as not found or removed upstream (1 attempt(s)).",
    },
  },
  headers: {},
});
check("a withdrawn upstream model is not blamed on configuration", stale.code === "STALE_ROUTE");
check(
  "and does not tell anyone to unset a variable",
  !/FREELLM_MODEL/.test(stale.message),
  stale.message
);
check("and is retryable", stale.retryable === true);

// The other kind: FREELLM_MODEL genuinely names something not in the
// catalogue. Retrying cannot help, so it says what to change instead.
const noModel = errorFor({
  status: 404,
  body: { error: { message: "Model 'claude-haiku-4-5' is not in the catalog." } },
  headers: {},
});
const namedModel = freellm.MODEL !== "auto";
check(
  namedModel ? "404 names the setting to change" : "with MODEL=auto even a catalog 404 reads as upstream",
  namedModel ? /FREELLM_MODEL/.test(noModel.message) : noModel.code === "STALE_ROUTE",
  noModel.message
);

// The router is up but its dashboard has no provider keys. Waiting will not
// fix it and neither will retrying.
const noKeys = errorFor({
  status: 503,
  body: { error: { message: "No candidate model has a configured, usable provider key." } },
  headers: {},
});
check("503 about provider keys says where to add them", /dashboard/i.test(noKeys.message), noKeys.message);
check("and is distinguishable from a plain fault", noKeys.code === "NO_PROVIDER_KEYS");

// Seen in the browser as a red box saying the router "refused the request",
// which read as a bug in this application. It is one model garbling its own
// tool call. The router fails over when it has somewhere to go - its log shows
// 20b failing and 120b answering the identical messages a second later - so
// this only surfaces when everything else is rate limited, and asking again
// is what the router itself would have done.
const badTool = errorFor({
  status: 400,
  body: {
    error: {
      message:
        "All routed providers rejected the request as invalid. Attempt trail: groq/openai/gpt-oss-20b key1: provider_bad_request. Last error: Groq API error 400: Failed to parse tool call arguments as JSON",
    },
  },
  headers: {},
});
check("a garbled tool call is recognised", badTool.code === "BAD_TOOL_CALL");
check("and is retried rather than shown as a refusal", RETRY_ONCE.has(badTool.code));
check(
  "and is not blamed on the request that was sent",
  !/refused the request/.test(badTool.message),
  badTool.message
);

// A 400 that is genuinely about what was sent must not be retried forever.
const realBadRequest = errorFor({
  status: 400,
  body: { error: { message: "messages: field required" } },
  headers: {},
});
check(
  "an ordinary bad request is not mistaken for one",
  realBadRequest.code !== "BAD_TOOL_CALL",
  realBadRequest.message
);

const badKey = errorFor({ status: 401, body: { error: { message: "unauthorized" } }, headers: {} });
check("401 names FREELLM_API_KEY", /FREELLM_API_KEY/.test(badKey.message), badKey.message);

const fault = errorFor({ status: 502, body: { error: { message: "upstream" } }, headers: {} });
check("a 5xx is a router fault", fault.code === "ROUTER_FAULT");
check("and is retryable", fault.retryable === true);

// A reverse proxy in front of the router serving an HTML error page. Keeping
// the first of it is what makes that diagnosable at all.
const html = errorFor({
  status: 502,
  body: { error: { message: "<html><head><title>502 Bad Gateway</title>" } },
  headers: {},
});
check("an HTML error page still produces a usable message", /502 Bad Gateway/.test(html.message));

console.log("\nConfiguration\n");

check('the default model is "auto", never a named one', freellm.MODEL === "auto");
check("the base URL points at a /v1 prefix", /\/v1$/.test(freellm.BASE_URL), freellm.BASE_URL);
check("a key makes it configured", freellm.isConfigured === true);
// It screens on "auto" too. The purpose-built classifier it used to call is
// unreachable through the router - a 512-token context is below what the
// router will route to, so every request came back 413 and screening silently
// stopped happening.
check("screening also goes through auto", freellm.SCREEN_MODEL === "auto");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
