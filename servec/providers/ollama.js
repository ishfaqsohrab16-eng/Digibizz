const http = require("http");
const https = require("https");
const { URL } = require("url");

/**
 * Talks to an Ollama server.
 *
 * Written against Node's own http module rather than fetch: the deployment
 * pins Node 18, where fetch is still flagged experimental and prints a warning
 * on first use. No dependency is added for this.
 *
 * Ollama is normally reached over the local network or a private one, so this
 * handles both http and https and does not assume TLS.
 */

const BASE_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";

/**
 * The model to ask.
 *
 * Choose one that follows instructions and writes SQL. Small models will
 * produce confident, wrong joins - the guard makes that safe, but it does not
 * make it useful.
 */
const MODEL = process.env.OLLAMA_MODEL || "llama3.1";

/**
 * How long to wait for a reply.
 *
 * Generous, because a local model on a busy machine is genuinely slow and the
 * alternative to waiting is a half-written answer. The request is abandoned
 * cleanly at the end of it rather than hanging.
 */
const TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS) || 120000;

const isConfigured = Boolean(BASE_URL);

class OllamaError extends Error {
  constructor(message, { status, retryable } = {}) {
    super(message);
    this.name = "OllamaError";
    this.status = status;
    this.retryable = Boolean(retryable);
  }
}

/** One request, with a timeout that actually fires. */
const request = (path, payload) =>
  new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(path, BASE_URL);
    } catch {
      return reject(
        new OllamaError(`OLLAMA_URL is not a valid URL: ${BASE_URL}`)
      );
    }

    const body = payload ? JSON.stringify(payload) : null;
    const transport = url.protocol === "https:" ? https : http;

    const req = transport.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: url.pathname + url.search,
        method: payload ? "POST" : "GET",
        headers: {
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
            parsed = { error: raw.slice(0, 400) };
          }
          resolve({ status: response.statusCode, body: parsed });
        });
      }
    );

    // A socket timeout does not reject on its own; without this the promise
    // never settles and the request hangs until the browser gives up.
    req.on("timeout", () => {
      req.destroy(
        new OllamaError(
          `The model did not answer within ${Math.round(TIMEOUT_MS / 1000)}s`,
          { retryable: true }
        )
      );
    });

    req.on("error", (error) => {
      reject(
        error instanceof OllamaError
          ? error
          : new OllamaError(
              `Could not reach Ollama at ${BASE_URL}: ${error.message}`,
              { retryable: true }
            )
      );
    });

    if (body) req.write(body);
    req.end();
  });

/**
 * Ask the model, and get one reply.
 *
 * Non-streaming on purpose. The answer is not shown as it arrives - it is
 * parsed, its SQL is run, and only then is there anything worth displaying, so
 * streaming would show the machinery rather than the answer.
 *
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} [options]
 * @param {boolean} [options.json] ask for a JSON object back
 */
const chat = async (messages, { json = false, temperature = 0 } = {}) => {
  const response = await request("/api/chat", {
    model: MODEL,
    messages,
    stream: false,
    ...(json ? { format: "json" } : {}),
    options: {
      // Zero, because this writes SQL and summarises numbers. Invention is not
      // a feature here.
      temperature,
      num_ctx: Number(process.env.OLLAMA_NUM_CTX) || 8192,
    },
  });

  if (response.status === 404) {
    throw new OllamaError(
      `Ollama has no model called "${MODEL}". Pull it first: ollama pull ${MODEL}`
    );
  }
  if (response.status < 200 || response.status >= 300) {
    throw new OllamaError(
      `Ollama answered ${response.status}: ${
        response.body?.error || "no detail"
      }`,
      { status: response.status, retryable: response.status >= 500 }
    );
  }

  const content = response.body?.message?.content;
  if (typeof content !== "string") {
    throw new OllamaError("Ollama returned no message content");
  }

  return content;
};

/** Is the server up, and does it have the model? */
const health = async () => {
  const response = await request("/api/tags");
  if (response.status < 200 || response.status >= 300) {
    throw new OllamaError(`Ollama answered ${response.status}`);
  }

  const models = (response.body?.models || []).map((entry) => entry.name);
  // Ollama reports "llama3.1:latest" for a model pulled as "llama3.1".
  const present = models.some(
    (name) => name === MODEL || name.split(":")[0] === MODEL.split(":")[0]
  );

  return { ok: true, model: MODEL, present, models };
};

module.exports = { chat, health, isConfigured, MODEL, BASE_URL, OllamaError };
