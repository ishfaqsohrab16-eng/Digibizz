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
const { errorFor, noteQuota, quotaState } = freellm._internals;

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

// Only reachable by setting FREELLM_MODEL to something not in the catalogue.
// The fix is to unset it, so the message says exactly that.
const noModel = errorFor({
  status: 404,
  body: { error: { message: "Model 'claude-haiku-4-5' is not in the catalog." } },
  headers: {},
});
check("404 names the setting to change", /FREELLM_MODEL/.test(noModel.message), noModel.message);
check("and recommends auto", /auto/.test(noModel.message));

// The router is up but its dashboard has no provider keys. Waiting will not
// fix it and neither will retrying.
const noKeys = errorFor({
  status: 503,
  body: { error: { message: "No candidate model has a configured, usable provider key." } },
  headers: {},
});
check("503 about provider keys says where to add them", /dashboard/i.test(noKeys.message), noKeys.message);
check("and is distinguishable from a plain fault", noKeys.code === "NO_PROVIDER_KEYS");

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
