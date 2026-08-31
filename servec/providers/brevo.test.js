/**
 * Regression tests for the Brevo client's translation layer.
 *
 * Run with:  node servec/providers/brevo.test.js
 * Exits non-zero if any rule regresses. No network.
 *
 * The client's job is translation: nodemailer-shaped arguments in, Brevo-shaped
 * JSON out, and Brevo's status codes back into decisions the callers can act on.
 * Getting the decisions wrong is what hurts - retrying an unverified sender
 * forever, or giving up on a 429 that would have succeeded a second later - so
 * that is most of what is checked here.
 */
process.env.BREVO_API_KEY = process.env.BREVO_API_KEY || "test-key";
process.env.BREVO_SENDER_EMAIL =
  process.env.BREVO_SENDER_EMAIL || "noreply@example.test";

const { _internals, BrevoError } = require("./brevo");
const { toRecipients, toAttachments, errorForResponse } = _internals;

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

console.log("\nRecipients\n");

check(
  "a plain address becomes one recipient",
  JSON.stringify(toRecipients("ali@example.com")) ===
    JSON.stringify([{ email: "ali@example.com" }])
);

// The campaign dispatcher passes one address, but announcements and test copies
// pass nodemailer's comma-separated form.
check(
  "a comma-separated list is split",
  toRecipients("a@x.com, b@x.com").length === 2,
  JSON.stringify(toRecipients("a@x.com, b@x.com"))
);

check(
  "surrounding spaces are trimmed",
  toRecipients("  a@x.com  ")[0].email === "a@x.com"
);

check(
  "an object keeps its name",
  toRecipients([{ email: "a@x.com", name: "Ali" }])[0].name === "Ali"
);

check("an empty string yields nothing", toRecipients("").length === 0);
check("undefined yields nothing", toRecipients(undefined).length === 0);
check(
  "blank entries in a list are dropped, not sent as empty recipients",
  toRecipients("a@x.com,,b@x.com").length === 2,
  JSON.stringify(toRecipients("a@x.com,,b@x.com"))
);

console.log("\nAttachments\n");

check("nothing in, nothing out", toAttachments(undefined) === undefined);
check("an empty list is omitted entirely", toAttachments([]) === undefined);

const buffered = toAttachments([
  { filename: "list.csv", content: Buffer.from("Email\na@x.com") },
]);
check(
  "a buffer is base64 encoded under Brevo's key names",
  buffered[0].name === "list.csv" &&
    Buffer.from(buffered[0].content, "base64").toString() === "Email\na@x.com",
  JSON.stringify(buffered)
);

const linked = toAttachments([
  { filename: "poster.png", path: "https://example.com/poster.png" },
]);
check(
  "a URL is passed through for Brevo to fetch",
  linked[0].url === "https://example.com/poster.png"
);

// A local path is readable here but not by Brevo. Sending it as a URL would
// produce an attachment nobody can open.
check(
  "a local file path is dropped rather than sent as a broken URL",
  toAttachments([{ filename: "x.pdf", path: "/var/app/x.pdf" }]) === undefined
);

console.log("\nWhat each failure means\n");

const mapped = (status, body) => errorForResponse({ status, body });

const badKey = mapped(401, { message: "Key not found" });
check("401 is a configuration problem, not a blip", badKey.retryable === false);
check("401 names the setting to fix", /BREVO_API_KEY/.test(badKey.message), badKey.message);

// The single most common first-run failure: the key works, the sender does not.
const badSender = mapped(400, {
  message: "Sender email is not valid or not verified",
});
check("an unverified sender is not retried", badSender.retryable === false);
check(
  "and the message says where to verify it",
  /Senders, Domains/.test(badSender.message),
  badSender.message
);

const outOfCredit = mapped(402, { message: "Not enough credits" });
check("402 is flagged as a quota problem", outOfCredit.quotaExceeded === true);
check("402 is not retried - tomorrow is the fix", outOfCredit.retryable === false);

const rateLimited = mapped(429, { message: "Too many requests" });
check("429 IS retried - Brevo never took the message", rateLimited.retryable === true);

check("a 502 from Brevo is retried", mapped(502, {}).retryable === true);
check("a 400 we do not recognise is not retried", mapped(400, { message: "bad" }).retryable === false);

check(
  "every mapping produces a BrevoError, so callers can read .retryable",
  [badKey, badSender, outOfCredit, rateLimited].every(
    (error) => error instanceof BrevoError
  )
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
