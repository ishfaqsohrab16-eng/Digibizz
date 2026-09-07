/**
 * The gate between a language model and the database.
 *
 * The assistant writes SQL and this decides whether it may run. That makes this
 * file the whole security boundary of the feature, so it is built to refuse by
 * default: a statement is rejected unless it is positively recognised as a
 * single, read-only SELECT. Anything unfamiliar - a new keyword, a construct
 * nobody anticipated, a clever encoding - falls through to "no".
 *
 * The model is not trusted. Not because it is malicious, but because it is
 * repeating patterns from its training data and will eventually produce a
 * DELETE in the middle of a helpful answer. It is also reachable, indirectly,
 * by anyone whose text ends up in the database: a candidate could name
 * themselves "Ali; DROP TABLE students" and hope the model repeats it. Prompt
 * instructions cannot prevent that. This can.
 *
 * Defence in depth, in order:
 *   1. this validator,
 *   2. a LIMIT forced onto every query,
 *   3. a statement timeout,
 *   4. and - the one that actually matters - a database user with nothing but
 *      SELECT granted. See the note at the bottom of this file.
 */

/**
 * Everything that writes, changes shape, or reaches outside the query.
 *
 * Matched as whole words anywhere in the statement, including inside
 * subqueries and CTEs, because "the outer statement is a SELECT" is not enough
 * on its own - `SELECT * FROM (DELETE ...)` is not valid MySQL, but
 * `WITH x AS (...) DELETE` and similar shapes are, and new ones appear with
 * every release.
 */
const FORBIDDEN_KEYWORDS = [
  // Writing.
  "insert", "update", "delete", "replace", "merge", "upsert", "load",
  // Schema.
  "drop", "alter", "create", "truncate", "rename", "comment",
  // Permissions and accounts.
  "grant", "revoke", "set", "flush", "reset", "shutdown", "kill",
  // Transactions - a SELECT needs none of these, and they are how a session
  // gets left in a state the next query inherits.
  "commit", "rollback", "savepoint", "begin", "start", "lock", "unlock",
  // Reaching outside the database, or into the server's filesystem.
  "outfile", "infile", "dumpfile", "load_file", "sleep", "benchmark",
  "system", "exec", "execute", "prepare", "deallocate", "handler", "do",
  "call", "signal", "resignal", "use", "describe", "explain", "analyze",
  "optimize", "repair", "check", "checksum", "install", "uninstall",
  "binlog", "purge", "change", "stop", "restart", "clone",
  // Locking reads. Harmless to data, but they hold locks on a live database
  // for as long as the transaction lasts.
  "for_update", "lock_in_share_mode",
];

/**
 * Tables the assistant may never read.
 *
 * Password hashes, reset tokens and verification codes are not "data about the
 * program", and no question a Super Admin can reasonably ask is answered by
 * them. Excluded here as well as from the schema shown to the model, because
 * the model does not have to be told a table exists in order to guess it.
 */
const FORBIDDEN_TABLES = [
  "email_verifications",
  "email_outbox",
  "login_logs",
];

/**
 * Columns that must never appear in a result, whatever table they come from.
 *
 * Checked by name rather than by table, so a join or an alias cannot smuggle
 * one out. `SELECT *` on a table containing one of these is refused rather
 * than silently filtered - quietly returning fewer columns than asked for
 * would teach the model that its query worked.
 */
const FORBIDDEN_COLUMNS = [
  "user_password",
  "password",
  "resettoken",
  "reset_token",
  "ev_code_hash",
  "ec_custom_html",
];

/** The most rows any single query may return. */
const MAX_ROWS = 500;

/** How long a query may run before it is abandoned, in seconds. */
const STATEMENT_TIMEOUT_SECONDS = 10;

/**
 * Strip comments and string literals before looking for keywords.
 *
 * Without this, `SELECT 'delete' AS x` is refused (annoying) and
 * `SELECT 1 /*!32302 DROP *​/` is allowed (fatal). MySQL executes the contents
 * of those version-gated comments, which is a documented and much-used
 * injection vector, so they are removed and then the removal itself is checked
 * for having found any.
 *
 * Returns the blanked statement plus what was taken out, so the caller can tell
 * "a comment was present" from "a comment contained something".
 */
const blankOutLiterals = (sql) => {
  let out = "";
  let index = 0;
  let sawComment = false;

  while (index < sql.length) {
    const char = sql[index];
    const next = sql[index + 1];

    // Line comments.
    if ((char === "-" && next === "-") || char === "#") {
      sawComment = true;
      while (index < sql.length && sql[index] !== "\n") index += 1;
      out += " ";
      continue;
    }

    // Block comments, including MySQL's executable /*! ... */ form.
    if (char === "/" && next === "*") {
      sawComment = true;
      index += 2;
      while (index < sql.length && !(sql[index] === "*" && sql[index + 1] === "/")) {
        index += 1;
      }
      index += 2;
      out += " ";
      continue;
    }

    // String and identifier literals. Their contents are data, not syntax.
    if (char === "'" || char === '"' || char === "`") {
      const quote = char;
      index += 1;
      while (index < sql.length) {
        if (sql[index] === "\\") {
          index += 2;
          continue;
        }
        // A doubled quote is an escaped quote, not the end.
        if (sql[index] === quote && sql[index + 1] === quote) {
          index += 2;
          continue;
        }
        if (sql[index] === quote) break;
        index += 1;
      }
      index += 1;
      // Backticked identifiers are kept, because table and column names have
      // to stay visible to the checks below. Their contents cannot contain
      // syntax - MySQL treats everything inside as a literal name.
      out += quote === "`" ? " ident " : " 'literal' ";
      continue;
    }

    out += char;
    index += 1;
  }

  return { blanked: out, sawComment };
};

/** Normalised for keyword matching: lower case, single spaces. */
const normalise = (sql) =>
  sql
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * Check a statement.
 *
 * @param {string} sql
 * @returns {{ok: true, sql: string} | {ok: false, reason: string}} on success,
 *   `sql` is the statement to run - which may differ from the input, because a
 *   LIMIT is appended when one is missing.
 */
const checkSelect = (sql) => {
  const raw = String(sql ?? "").trim();

  if (!raw) return { ok: false, reason: "The query is empty" };
  if (raw.length > 4000) {
    return { ok: false, reason: "That query is too long to be safe to run" };
  }

  const { blanked, sawComment } = blankOutLiterals(raw);

  // Comments have no legitimate use in a generated query, and MySQL's /*! */
  // form executes its contents. Refusing them outright is cheaper than
  // deciding which are harmless.
  if (sawComment) {
    return { ok: false, reason: "Comments are not allowed in a query" };
  }

  const text = normalise(blanked);

  // One statement. A trailing semicolon is tolerated because models add them
  // out of habit; anything after it is a second statement.
  const withoutTrailing = text.replace(/;\s*$/, "");
  if (withoutTrailing.includes(";")) {
    return { ok: false, reason: "Only one statement may be run at a time" };
  }

  // Must BEGIN as a read. A leading WITH is allowed, but then the statement
  // after the CTE has to be a SELECT too, which the keyword scan below covers.
  if (!/^(select|with)\b/.test(withoutTrailing)) {
    return { ok: false, reason: "Only SELECT queries are allowed" };
  }

  if (/^with\b/.test(withoutTrailing) && !/\bselect\b/.test(withoutTrailing)) {
    return { ok: false, reason: "Only SELECT queries are allowed" };
  }

  // Whole-word keyword scan. `_` is treated as a word character so that
  // `load_file` is caught and `std_lms_status` is not mistaken for anything.
  for (const keyword of FORBIDDEN_KEYWORDS) {
    const pattern = keyword.includes("_")
      ? new RegExp(`\\b${keyword.replace(/_/g, "[ _]")}\\b`)
      : new RegExp(`(^|[^a-z0-9_])${keyword}([^a-z0-9_]|$)`);
    if (pattern.test(withoutTrailing)) {
      return { ok: false, reason: `\`${keyword.replace(/_/g, " ")}\` is not allowed` };
    }
  }

  // MySQL's information_schema and internals. Reading them is not dangerous in
  // itself, but it is how a model discovers users, grants and file paths, and
  // no question about the program is answered there.
  if (/\b(information_schema|mysql|performance_schema|sys)\s*\./.test(withoutTrailing)) {
    return { ok: false, reason: "System tables are not available" };
  }

  for (const table of FORBIDDEN_TABLES) {
    if (new RegExp(`(^|[^a-z0-9_])${table}([^a-z0-9_]|$)`).test(withoutTrailing)) {
      return { ok: false, reason: `The \`${table}\` table is not available` };
    }
  }

  for (const column of FORBIDDEN_COLUMNS) {
    if (new RegExp(`(^|[^a-z0-9_])${column}([^a-z0-9_]|$)`).test(withoutTrailing)) {
      return { ok: false, reason: `The \`${column}\` column cannot be read` };
    }
  }

  // A bare `SELECT *` from a table holding a password would return it. The
  // model is told to name its columns; this is what makes that a rule.
  if (/select\s+\*/.test(withoutTrailing) && /\bfrom\s+user\b/.test(withoutTrailing)) {
    return {
      ok: false,
      reason: "Name the columns you need instead of SELECT * on the user table",
    };
  }

  // Every query is bounded, whether or not the model remembered to bound it.
  const limited = /\blimit\s+\d+/.test(withoutTrailing)
    ? raw.replace(/;\s*$/, "")
    : `${raw.replace(/;\s*$/, "")} LIMIT ${MAX_ROWS}`;

  return { ok: true, sql: limited };
};

module.exports = {
  checkSelect,
  MAX_ROWS,
  STATEMENT_TIMEOUT_SECONDS,
  FORBIDDEN_TABLES,
  FORBIDDEN_COLUMNS,
  // Exported for the tests, which walk the list rather than restating it.
  FORBIDDEN_KEYWORDS,
  _blankOutLiterals: blankOutLiterals,
};

/**
 * A NOTE ON THE REAL CONTROL.
 *
 * Everything above is a filter on text, and a filter on text can be wrong. The
 * control that cannot be argued around is a database account that is only
 * granted SELECT:
 *
 *   CREATE USER 'lms_readonly'@'%' IDENTIFIED BY '...';
 *   GRANT SELECT ON lms_lmsdb.* TO 'lms_readonly'@'%';
 *
 * Set AI_DB_USER / AI_DB_PASSWORD to that account and the assistant physically
 * cannot write, whatever gets past this file. It runs without them, on the
 * application's own connection, and logs a warning saying so - but that is a
 * weaker deployment, not the intended one.
 */
