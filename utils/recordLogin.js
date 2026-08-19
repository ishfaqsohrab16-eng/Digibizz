const LoginLog = require("../models/loginLogModel");

/**
 * Write a staff login to login_logs.
 *
 * Students are skipped - see the note on the model.
 *
 * This never throws and never blocks the response. A login must not fail
 * because the audit table is unavailable; a missing log line is recoverable,
 * locking every member of staff out of the LMS is not.
 */

const STUDENT = "student";

/**
 * Resolve the client IP.
 *
 * The app sits behind a proxy in production, so `req.socket.remoteAddress` is
 * the proxy, not the user. X-Forwarded-For is a comma-separated chain with the
 * original client left-most, so that entry is the one worth storing. The raw
 * chain is kept too: the header is client-settable, and having both is what
 * makes a forged value detectable rather than merely wrong.
 */
const resolveIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  const chain = Array.isArray(forwarded) ? forwarded.join(", ") : forwarded || "";

  const firstHop = chain.split(",")[0]?.trim();
  const direct =
    req.ip ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    "";

  // Normalise the IPv4-mapped IPv6 form (::ffff:1.2.3.4) that Node reports
  // on dual-stack sockets, so the column holds a plain address.
  const raw = firstHop || direct;
  const ip = String(raw).replace(/^::ffff:/i, "");

  return { ip: ip.slice(0, 45) || null, chain: chain ? chain.slice(0, 255) : null };
};

/**
 * @param {import("express").Request} req
 * @param {object} user               The authenticated user row.
 * @param {object} [context]
 * @param {number} [context.center_id]
 * @param {number} [context.course_id]
 * @param {number} [context.tb_id]
 * @param {string} [context.method]           "password" | "impersonation"
 * @param {number} [context.impersonatedBy]   Admin user_id, for impersonation.
 */
const recordLogin = async (req, user, context = {}) => {
  try {
    if (!user) return;

    const type = String(user.user_type ?? "").trim().toLowerCase();
    if (type === STUDENT) return;

    const { ip, chain } = resolveIp(req);
    const agent = req.headers["user-agent"];

    await LoginLog.create({
      user_id: user.user_id,
      ll_user_name: user.user_name || null,
      ll_user_username: user.user_username || null,
      ll_user_type: user.user_type || null,
      ll_ip: ip,
      ll_forwarded_for: chain,
      ll_user_agent: agent ? String(agent).slice(0, 512) : null,
      ll_method: context.method || "password",
      ll_impersonated_by: context.impersonatedBy ?? null,
      ll_center_id: context.center_id ?? null,
      ll_course_id: context.course_id ?? null,
      ll_tb_id: context.tb_id ?? null,
      ll_login_at: new Date(),
    });
  } catch (error) {
    console.error("[login-log] could not record login:", error?.message || error);
  }
};

module.exports = { recordLogin, resolveIp };
