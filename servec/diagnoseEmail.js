/**
 * Where does a verification code actually go?
 *
 *   node servec/diagnoseEmail.js                  -> time every stage, send nothing
 *   node servec/diagnoseEmail.js you@example.com  -> also send a real code email
 *
 * Run this on the server, not a laptop - the question is what the SERVER can
 * reach. "The code is late" has four possible homes and they need different
 * fixes, so the point of this script is to say which one:
 *
 *   1. DNS      - the mail host resolves slowly, or resolves to nothing.
 *   2. TCP/TLS  - the port is filtered, or the handshake is slow.
 *   3. AUTH     - credentials are wrong; nothing has ever been sent.
 *   4. Handover - the app hands the message over in a second, and it still
 *                 arrives ten minutes later. Then the delay is NOT in this
 *                 application: it is the mail server's own outbound queue, or
 *                 greylisting at the recipient's provider. Look in the mail
 *                 server's logs (Poste.io: Status -> Queue) - nothing in this
 *                 repository can shorten it.
 *
 * Timings are printed per stage so the slow one is obvious rather than inferred.
 */
require("dotenv").config();
const dns = require("dns");
const net = require("net");
const { performance } = require("perf_hooks");
const {
  sendEmail,
  verifyTransport,
  transporter,
  priorityTransporter,
  isConfigured,
  provider,
} = require("./emailConfig");
const { verificationCode } = require("./campaignTemplates");

const recipient = process.argv[2];

const HOST = process.env.SMTP_HOST;
const PORT = Number(process.env.SMTP_PORT) || 465;

/** Run a step, print how long it took, and never let it throw. */
const timed = async (label, fn) => {
  const startedAt = performance.now();
  try {
    const value = await fn();
    const ms = Math.round(performance.now() - startedAt);
    console.log(`  ${label.padEnd(28)} ${String(ms).padStart(6)} ms   OK`);
    return { ok: true, ms, value };
  } catch (error) {
    const ms = Math.round(performance.now() - startedAt);
    console.log(
      `  ${label.padEnd(28)} ${String(ms).padStart(6)} ms   FAILED  ${
        error.code ? `[${error.code}] ` : ""
      }${error.message}`
    );
    return { ok: false, ms, error };
  }
};

/** Resolve the host the way Node will when it connects. */
const lookup = () =>
  new Promise((resolve, reject) => {
    dns.lookup(HOST, { all: true }, (error, addresses) => {
      if (error) return reject(error);
      resolve(addresses);
    });
  });

/**
 * Open a bare TCP socket.
 *
 * Separating this from the TLS/AUTH check matters: a firewall dropping port 465
 * and a wrong password both look like "email is broken" from the application,
 * and only one of them is fixable in the .env file.
 */
const tcpConnect = () =>
  new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: HOST, port: PORT });
    const done = (error) => {
      socket.destroy();
      if (error) reject(error);
      else resolve(true);
    };
    socket.setTimeout(10000);
    socket.once("connect", () => done(null));
    socket.once("timeout", () => done(new Error(`timed out connecting to ${HOST}:${PORT}`)));
    socket.once("error", done);
  });

(async () => {
  if (provider === "brevo") {
    console.log("Brevo settings in use");
    console.log("  key   :", process.env.BREVO_API_KEY ? "(set)" : "(NOT SET)");
    console.log(
      "  from  :",
      process.env.BREVO_SENDER_EMAIL || process.env.SMTP_FROM || "(not set)"
    );
    console.log(
      "  fallback to SMTP:",
      String(process.env.EMAIL_FALLBACK_TO_SMTP || "true").toLowerCase() !== "false"
    );
  } else {
    console.log("SMTP settings in use");
    console.log("  host  :", HOST || "(not set)");
    console.log("  port  :", PORT);
    console.log(
      "  secure:",
      process.env.SMTP_SECURE ?? `(defaulted from port: ${PORT === 465})`
    );
    console.log("  user  :", process.env.SMTP_USER || "(not set)");
    console.log("  pass  :", process.env.SMTP_PASS ? "(set)" : "(NOT SET)");
    console.log(
      "  from  :",
      process.env.SMTP_FROM || process.env.SMTP_USER || "(not set)"
    );
    console.log(
      "  tls.rejectUnauthorized:",
      String(process.env.SMTP_TLS_REJECT_UNAUTHORIZED).toLowerCase() === "true"
    );
  }
  console.log("");

  if (!isConfigured) {
    console.error(
      provider === "brevo"
        ? "Brevo is selected but not configured. Set BREVO_API_KEY, and a\n" +
          "BREVO_SENDER_EMAIL that is verified in the Brevo dashboard.\n" +
          "Until then no email of any kind is sent - verification codes included."
        : "SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS in .env.\n" +
          "Until then no email of any kind is sent - verification codes included."
    );
    process.exit(1);
  }

  if (provider === "brevo") {
    console.log("Provider: brevo (HTTPS to api.brevo.com)\n");
    console.log("Stages");

    const account = await timed("1. Key + account check", async () => {
      const result = await verifyTransport();
      if (!result) throw new Error("verification failed - see the error above");
      return result;
    });

    let brevoSend = null;
    if (recipient) {
      const { subject, text, html } = verificationCode({
        code: "123456",
        expiresInMinutes: 15,
      });
      brevoSend = await timed("2. Send a code email", () =>
        sendEmail({ to: recipient, subject, text, html, priority: true })
      );
    }

    console.log("");
    console.log("Verdict");

    if (!account.ok) {
      console.log(
        "  Brevo rejected the key or could not be reached. Check BREVO_API_KEY,\n" +
          "  and that this host can make outbound HTTPS requests."
      );
    } else if (!recipient) {
      console.log(
        "  Key and account are good. Pass an address to measure a real send:\n" +
          "  node servec/diagnoseEmail.js you@example.com"
      );
    } else if (!brevoSend.ok) {
      console.log(
        "  Brevo refused the message. The error above says why - most often the\n" +
          "  From address has not been verified in the Brevo dashboard, under\n" +
          "  Senders, Domains & Dedicated IPs."
      );
    } else {
      console.log(`  Brevo accepted the message in ${brevoSend.ms} ms.`);
      console.log(
        "  That is the whole of this application's contribution to the delay. If\n" +
          `  the email to ${recipient} still arrives late, the wait is inside\n` +
          "  Brevo or at the recipient's provider. Brevo's own logs (Transactional\n" +
          "  -> Logs) show what happened to it after this point."
      );
    }

    process.exitCode = account.ok && (!brevoSend || brevoSend.ok) ? 0 : 1;
    return;
  }

  console.log("Provider: smtp\n");
  console.log("Stages");
  const resolved = await timed("1. DNS lookup", lookup);
  if (resolved.ok) {
    console.log(
      "     ->",
      resolved.value.map((a) => `${a.address} (IPv${a.family})`).join(", ")
    );
  }

  const tcp = await timed(`2. TCP connect :${PORT}`, tcpConnect);
  const verified = await timed("3. TLS + AUTH (verify)", async () => {
    const ok = await verifyTransport();
    if (!ok) throw new Error("verify() reported failure - see the error above");
    return ok;
  });

  let sent = null;
  if (recipient) {
    const { subject, text, html } = verificationCode({
      code: "123456",
      expiresInMinutes: 15,
    });
    sent = await timed("4. Send a code email", () =>
      sendEmail({
        to: recipient,
        subject,
        text,
        html,
        // The same transport a real registration uses, so this measures what
        // an applicant actually experiences rather than something adjacent.
        priority: true,
      })
    );
  }

  console.log("");
  console.log("Verdict");

  if (!resolved.ok) {
    console.log(
      `  ${HOST} does not resolve from this machine. Check the DNS record and,\n` +
        "  in Docker, that the container uses a working resolver."
    );
  } else if (resolved.ms > 2000) {
    console.log(
      `  DNS took ${resolved.ms} ms. That is paid on every message. Check the\n` +
        "  resolver configured for this host or container."
    );
  }

  if (!tcp.ok) {
    console.log(
      `  Port ${PORT} on ${HOST} is not reachable. Nothing can be sent until it is.\n` +
        "  Usual causes: a firewall or hosting provider blocking outbound SMTP,\n" +
        "  the wrong port (465 = implicit TLS, 587 = STARTTLS with SMTP_SECURE=false),\n" +
        "  or the hairpin problem described below."
    );
  } else if (tcp.ms > 1500) {
    console.log(
      `  The TCP connect took ${tcp.ms} ms, which is very slow for a mail server.`
    );
  }

  // Worth saying whenever both are on one host, because it is invisible from
  // inside the application: every symptom is a slow or failed send.
  if (resolved.ok && (!tcp.ok || tcp.ms > 1500)) {
    console.log(
      "  If the mail server runs in a container on THIS host, the address above\n" +
        "  is its public IP: the connection is leaving the machine and coming back\n" +
        "  in (hairpin NAT), which many hosts route slowly or drop entirely. Point\n" +
        `  SMTP_HOST at the mail container's name on the shared Docker network\n` +
        "  instead of the public hostname, and it connects in milliseconds."
    );
  }

  if (!verified.ok) {
    console.log(
      "  The mail server refused the connection or the credentials. No email has\n" +
        "  been going out at all - fix this before looking anywhere else."
    );
  }

  if (sent && !sent.ok) {
    console.log(
      "  Handover FAILED. The message was never accepted by the mail server, so\n" +
        "  no delay explanation is needed - see the error above."
    );
  }

  if (sent && sent.ok) {
    console.log(
      `  The mail server accepted the message in ${sent.ms} ms.`
    );
    console.log(
      "  That is the whole of this application's contribution to the delay.\n" +
        `  If the email to ${recipient} still turns up minutes later, the wait is\n` +
        "  after this point - the mail server's outbound queue, or greylisting at\n" +
        "  the recipient's provider - and no change to this codebase will shorten\n" +
        "  it. Check the mail server's queue and logs next.\n" +
        "  If it never turns up at all, check the spam folder, then SPF/DKIM/DMARC\n" +
        "  for the sending domain."
    );
  }

  if (verified.ok && !recipient) {
    console.log(
      "  Connection and credentials are good. Pass an address to measure a real\n" +
        "  send:  node servec/diagnoseEmail.js you@example.com"
    );
  }

  transporter.close();
  priorityTransporter.close();
  process.exitCode = resolved.ok && tcp.ok && verified.ok && (!sent || sent.ok) ? 0 : 1;
})().catch((error) => {
  console.error("\nDiagnostic itself failed:", error);
  process.exit(1);
});
