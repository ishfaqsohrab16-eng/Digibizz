const https = require("https");

/**
 * Brevo (formerly Sendinblue) transactional email, over the HTTP API.
 *
 * Chosen over Brevo's SMTP relay deliberately. The relay would have worked with
 * the existing nodemailer code, but every problem this deployment has had with
 * email has been an SMTP problem: a container that cannot reach port 465 on its
 * own host, connections closed while idle, handshakes that hang. This is an
 * ordinary HTTPS POST to a public host on 443 - the one thing an application
 * container can always do - and it returns a message id and a real error
 * message instead of a socket that goes quiet.
 *
 * Written against Node's own https module rather than fetch: the deployment
 * pins Node 18, where fetch is still flagged experimental and prints a warning
 * on first use. No dependency is added for this.
 *
 * API: POST https://api.brevo.com/v3/smtp/email, authenticated with an
 * `api-key` header. Docs: https://developers.brevo.com/docs/send-a-transactional-email
 */

const API_HOST = "api.brevo.com";
const SEND_PATH = "/v3/smtp/email";
const ACCOUNT_PATH = "/v3/account";
const CONTACTS_PATH = "/v3/contacts";

const BREVO_API_KEY = process.env.BREVO_API_KEY || "";

/**
 * The address mail is sent from.
 *
 * Brevo will not send from an address it has not verified, so this cannot
 * silently default to something plausible - an unverified sender fails every
 * send with the same opaque 400. Falls back to the SMTP_FROM already in the
 * environment, which is the address the program actually uses.
 */
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || process.env.SMTP_FROM || "";
const SENDER_NAME =
  process.env.BREVO_SENDER_NAME || process.env.SMTP_FROM_NAME || "Digibizz Program";

const REQUEST_TIMEOUT_MS = Number(process.env.BREVO_TIMEOUT_MS) || 15000;

const isBrevoConfigured = Boolean(BREVO_API_KEY && SENDER_EMAIL);

/**
 * An error carrying enough to decide what to do next.
 *
 * `retryable` is the important field: the caller must not retry an unverified
 * sender or a bad key, and must retry a 502 from a load balancer.
 */
class BrevoError extends Error {
  constructor(message, { status, code, retryable, quotaExceeded } = {}) {
    super(message);
    this.name = "BrevoError";
    this.status = status;
    this.code = code;
    this.retryable = Boolean(retryable);
    this.quotaExceeded = Boolean(quotaExceeded);
  }
}

/** One HTTPS request, with a timeout that actually fires. */
const apiRequest = (path, { method = "POST", payload } = {}) =>
  new Promise((resolve, reject) => {
    const body = payload ? JSON.stringify(payload) : null;

    const request = https.request(
      {
        host: API_HOST,
        path,
        method,
        headers: {
          "api-key": BREVO_API_KEY,
          accept: "application/json",
          ...(body
            ? {
                "content-type": "application/json",
                "content-length": Buffer.byteLength(body),
              }
            : {}),
        },
        timeout: REQUEST_TIMEOUT_MS,
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
            // Brevo answers JSON; anything else is a proxy or an outage page,
            // and the raw text is more use in the log than a parse error.
            parsed = { message: raw.slice(0, 300) };
          }
          resolve({ status: response.statusCode, body: parsed });
        });
      }
    );

    // A socket timeout does not reject on its own - without this the promise
    // never settles and the caller waits forever.
    request.on("timeout", () => {
      request.destroy(
        new BrevoError(`Brevo did not answer within ${REQUEST_TIMEOUT_MS}ms`, {
          retryable: true,
        })
      );
    });

    request.on("error", (error) => {
      reject(
        error instanceof BrevoError
          ? error
          : new BrevoError(`Could not reach Brevo: ${error.message}`, {
              code: error.code,
              retryable: true,
            })
      );
    });

    if (body) request.write(body);
    request.end();
  });

/** Accepts a string, a comma-separated string, or an array; Brevo wants objects. */
const toRecipients = (value) => {
  const list = Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((entry) => entry.trim());

  return list
    .filter(Boolean)
    .map((entry) =>
      typeof entry === "string" ? { email: entry } : { email: entry.address || entry.email, name: entry.name }
    )
    .filter((entry) => entry.email);
};

/**
 * nodemailer-shaped attachments to Brevo's shape.
 *
 * Brevo takes either a URL it can fetch or base64 content. Anything else - a
 * stream, a path this process can read but Brevo cannot - is dropped rather
 * than sent as something wrong, and says so in the log.
 */
const toAttachments = (attachments) => {
  if (!Array.isArray(attachments) || attachments.length === 0) return undefined;

  const mapped = attachments
    .map((attachment) => {
      if (attachment?.path && /^https?:\/\//i.test(attachment.path)) {
        return { url: attachment.path, name: attachment.filename };
      }
      if (attachment?.content) {
        const buffer = Buffer.isBuffer(attachment.content)
          ? attachment.content
          : Buffer.from(String(attachment.content), attachment.encoding || "utf8");
        return {
          name: attachment.filename || "attachment",
          content: buffer.toString("base64"),
        };
      }
      console.warn(
        "[brevo] dropped an attachment Brevo cannot take:",
        attachment?.filename || "(unnamed)"
      );
      return null;
    })
    .filter(Boolean);

  return mapped.length ? mapped : undefined;
};

/** Turn a non-2xx answer into an error that says what to do about it. */
const errorForResponse = ({ status, body }) => {
  const code = body?.code || "";
  const detail = body?.message || "(no message)";

  if (status === 401) {
    return new BrevoError(
      `Brevo rejected the API key. Check BREVO_API_KEY. (${detail})`,
      { status, code, retryable: false }
    );
  }

  // The most common first-run failure by a distance: the key is fine, but the
  // From address has not been verified in the Brevo dashboard.
  if (status === 400 && /sender/i.test(detail)) {
    return new BrevoError(
      `Brevo will not send from ${SENDER_EMAIL}: ${detail}. Verify that address ` +
        "under Senders, Domains & Dedicated IPs in the Brevo dashboard.",
      { status, code, retryable: false }
    );
  }

  if (status === 402 || /credit/i.test(code) || /credit/i.test(detail)) {
    return new BrevoError(
      `Brevo's daily sending allowance is used up: ${detail}`,
      { status, code, retryable: false, quotaExceeded: true }
    );
  }

  // 429 is Brevo asking us to slow down, not to stop.
  if (status === 429) {
    return new BrevoError(`Brevo rate limited this send: ${detail}`, {
      status,
      code,
      retryable: true,
    });
  }

  if (status >= 500) {
    return new BrevoError(`Brevo is having a problem (${status}): ${detail}`, {
      status,
      code,
      retryable: true,
    });
  }

  return new BrevoError(`Brevo refused the message (${status}): ${detail}`, {
    status,
    code,
    retryable: false,
  });
};

/**
 * Send one message.
 *
 * Returns a nodemailer-shaped result so callers that already log `messageId`,
 * `accepted` and `rejected` keep working unchanged.
 */
const sendViaBrevo = async ({
  to,
  subject,
  html,
  text,
  replyTo,
  cc,
  bcc,
  attachments,
  tags,
}) => {
  if (!isBrevoConfigured) {
    throw new BrevoError(
      "Brevo is not configured. Set BREVO_API_KEY and a verified BREVO_SENDER_EMAIL.",
      { retryable: false }
    );
  }

  const recipients = toRecipients(to);
  if (recipients.length === 0) {
    throw new BrevoError("sendViaBrevo: no recipient specified", { retryable: false });
  }

  const payload = {
    sender: { email: SENDER_EMAIL, name: SENDER_NAME },
    to: recipients,
    subject,
    ...(html ? { htmlContent: html } : {}),
    ...(text ? { textContent: text } : {}),
    ...(cc ? { cc: toRecipients(cc) } : {}),
    ...(bcc ? { bcc: toRecipients(bcc) } : {}),
    ...(replyTo ? { replyTo: toRecipients(replyTo)[0] } : {}),
    ...(toAttachments(attachments) ? { attachment: toAttachments(attachments) } : {}),
    ...(Array.isArray(tags) && tags.length ? { tags } : {}),
  };

  const response = await apiRequest(SEND_PATH, { payload });

  if (response.status < 200 || response.status >= 300) {
    throw errorForResponse(response);
  }

  const addresses = recipients.map((recipient) => recipient.email);
  return {
    messageId: response.body?.messageId || "(no id)",
    accepted: addresses,
    rejected: [],
    response: `${response.status} accepted by Brevo`,
  };
};

/**
 * Check the key and report the plan, without sending anything.
 *
 * The credit figure is the useful part: on the free plan it is the day's
 * remaining allowance, which is the number that decides whether a campaign can
 * run today.
 */
const verifyBrevo = async () => {
  if (!isBrevoConfigured) return { ok: false, reason: "not configured" };

  const response = await apiRequest(ACCOUNT_PATH, { method: "GET" });
  if (response.status < 200 || response.status >= 300) {
    throw errorForResponse(response);
  }

  const plans = Array.isArray(response.body?.plan) ? response.body.plan : [];
  const sendPlan = plans.find((plan) => plan.creditsType === "sendLimit") || plans[0];

  return {
    ok: true,
    email: response.body?.email,
    company: response.body?.companyName,
    planType: sendPlan?.type,
    credits: sendPlan?.credits,
  };
};

/**
 * Delete one contact from the Brevo account, by email address.
 *
 * Brevo's transactional endpoint is documented as NOT creating contacts, so
 * most calls here are expected to come back 404. That is reported as a
 * success with existed:false rather than as an error - the caller's goal is
 * "this address is not in the account", and 404 already satisfies it.
 *
 * The address goes in the path, so it must be encoded: an unencoded '+' in
 * a perfectly legal address would otherwise be read as a space and delete
 * the wrong contact, or nothing at all.
 */
const deleteContact = async (email) => {
  if (!isBrevoConfigured) {
    throw new BrevoError("Brevo is not configured", { retryable: false });
  }

  const address = String(email || "").trim();
  if (!address) {
    throw new BrevoError("deleteContact: no address given", { retryable: false });
  }

  const response = await apiRequest(
    `${CONTACTS_PATH}/${encodeURIComponent(address)}`,
    { method: "DELETE" }
  );

  if (response.status === 204 || response.status === 200) {
    return { existed: true };
  }
  if (response.status === 404) {
    return { existed: false };
  }
  throw errorForResponse(response);
};

module.exports = {
  sendViaBrevo,
  deleteContact,
  verifyBrevo,
  isBrevoConfigured,
  BrevoError,
  SENDER_EMAIL,
  SENDER_NAME,
  // Exported for the tests, which drive the mapping without a network.
  _internals: { toRecipients, toAttachments, errorForResponse },
};
