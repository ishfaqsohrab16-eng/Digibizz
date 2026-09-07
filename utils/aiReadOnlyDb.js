const { Sequelize } = require("sequelize");
const { sequelize } = require("../config/db");
const { STATEMENT_TIMEOUT_SECONDS } = require("./sqlGuard");

/**
 * The connection the assistant's queries run on.
 *
 * utils/sqlGuard.js filters the SQL, and a filter on text can always be wrong.
 * The control that cannot be argued around is a database account with nothing
 * but SELECT granted:
 *
 *   CREATE USER 'lms_readonly'@'%' IDENTIFIED BY '...';
 *   GRANT SELECT ON lms_lmsdb.* TO 'lms_readonly'@'%';
 *   FLUSH PRIVILEGES;
 *
 * Set AI_DB_USER and AI_DB_PASSWORD to that account and the assistant
 * physically cannot write, whatever gets past the guard.
 *
 * Without them it falls back to the application's own connection and says so,
 * loudly, at boot. That is a weaker deployment, not the intended one - the
 * guard is then the only thing standing between a generated statement and the
 * data.
 */

const AI_DB_USER = process.env.AI_DB_USER;
const AI_DB_PASSWORD = process.env.AI_DB_PASSWORD;

/**
 * Half-configured is its own state, and the worst one to handle silently.
 *
 * Setting AI_DB_USER without AI_DB_PASSWORD is almost always a forgotten
 * variable. Connecting anyway fails on authentication and every question
 * answers "the assistant could not answer that", which sends you looking at
 * the model. Quietly falling back to the application's own connection would be
 * worse: it would work, while dropping exactly the protection that setting
 * AI_DB_USER was meant to add.
 *
 * So it is named as the misconfiguration it is, at boot and on the status
 * endpoint, and the assistant refuses to run queries until it is fixed.
 */
const missingPassword = Boolean(AI_DB_USER) && !AI_DB_PASSWORD;

const hasOwnAccount = Boolean(AI_DB_USER) && Boolean(AI_DB_PASSWORD);

if (missingPassword) {
  console.error(
    `[ai] AI_DB_USER is set to "${AI_DB_USER}" but AI_DB_PASSWORD is empty.`,
    "The assistant will not run any queries until both are set - it will not",
    "fall back to the application's own connection, because that would silently",
    "give it write access."
  );
}

let readOnly = null;

const connection = () => {
  if (readOnly) return readOnly;

  if (missingPassword) {
    const error = new Error(
      `AI_DB_USER is set to "${AI_DB_USER}" but AI_DB_PASSWORD is empty. ` +
        "Set the password for that account, or remove both to run on the " +
        "application's own connection."
    );
    error.code = "EAICONFIG";
    throw error;
  }

  if (!hasOwnAccount) {
    console.warn(
      "[ai] AI_DB_USER is not set, so the assistant runs on the application's own",
      "database connection. It is limited to SELECT by utils/sqlGuard.js alone.",
      "Create a SELECT-only account and set AI_DB_USER / AI_DB_PASSWORD."
    );
    readOnly = sequelize;
    return readOnly;
  }

  readOnly = new Sequelize(
    process.env.DB_NAME,
    AI_DB_USER,
    AI_DB_PASSWORD,
    {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      dialect: "mysql",
      charset: "utf8mb4",
      dialectOptions: {
        charset: "utf8mb4",
        // Belt and braces: even if a semicolon somehow survived the guard, the
        // driver will not run a second statement.
        multipleStatements: false,
      },
      logging: false,
      pool: {
        // Small on purpose. The assistant is one person asking questions, and a
        // large pool of long-running analytical queries is how a reporting tool
        // takes the application down with it.
        max: 2,
        min: 0,
        acquire: 20000,
        idle: 10000,
      },
    }
  );

  console.log(`[ai] queries run as the read-only account ${AI_DB_USER}`);
  return readOnly;
};

/**
 * Put a time limit on the statement.
 *
 * MySQL's optimiser hint rather than a session variable: SET is forbidden by
 * the guard, and changing session state on a pooled connection leaks into
 * whatever runs on it next.
 *
 * The hint has to sit on the FIRST select of the statement, which for a
 * `WITH ... SELECT` is the one inside the CTE - so a query written that way is
 * bounded less tightly than one that is not. The forced LIMIT still caps what
 * comes back either way.
 */
const withTimeLimit = (sql) =>
  sql.replace(
    /select/i,
    `SELECT /*+ MAX_EXECUTION_TIME(${STATEMENT_TIMEOUT_SECONDS * 1000}) */`
  );

/**
 * Run one already-validated SELECT.
 *
 * QueryTypes.SELECT resolves to the rows themselves, not to Sequelize's
 * [rows, metadata] pair. Destructuring it as a pair takes the first ROW and
 * calls it the result set, which looks like a query returning one record.
 */
const runQuery = async (sql) => {
  const db = connection();
  const startedAt = Date.now();

  const rows = await db.query(withTimeLimit(sql), {
    type: Sequelize.QueryTypes.SELECT,
    raw: true,
    // Deliberately none. The statement is complete and was checked exactly as
    // it stands; passing replacements would let a `:name` inside a string
    // literal be substituted after the guard had already approved the text.
  });

  return { rows: Array.isArray(rows) ? rows : [rows], ms: Date.now() - startedAt };
};

module.exports = { runQuery, hasOwnAccount, missingPassword };
