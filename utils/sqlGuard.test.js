/**
 * Adversarial tests for the SQL guard.
 *
 * Run with:  node utils/sqlGuard.test.js
 * Exits non-zero if any rule regresses.
 *
 * This file is the security boundary of the assistant, so the tests are written
 * as attacks rather than as examples. The model writing these queries is not
 * malicious, but it is repeating patterns from its training data and will
 * eventually produce a DELETE inside a helpful answer - and it is reachable
 * indirectly by anyone whose text reaches the database, because a candidate can
 * name themselves "Ali'; DROP TABLE students; --" and hope it gets echoed.
 */
const { checkSelect, FORBIDDEN_KEYWORDS, MAX_ROWS } = require("./sqlGuard");

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

/** Must be refused. */
const refuse = (name, sql) => {
  const result = checkSelect(sql);
  check(name, result.ok === false, result.ok ? `ALLOWED: ${result.sql}` : undefined);
};

/** Must be allowed. */
const allow = (name, sql) => {
  const result = checkSelect(sql);
  check(name, result.ok === true, result.ok ? undefined : result.reason);
  return result;
};

console.log("\nOrdinary questions still work\n");

allow("a simple count", "SELECT COUNT(*) AS total FROM students");
allow(
  "a join",
  "SELECT c.center_name, COUNT(s.std_id) AS students FROM students s JOIN center c ON c.center_id = s.center_id GROUP BY c.center_name"
);
allow(
  "a CTE",
  "WITH per_centre AS (SELECT center_id, COUNT(*) n FROM students GROUP BY center_id) SELECT * FROM per_centre ORDER BY n DESC"
);
allow("a subquery", "SELECT * FROM (SELECT tb_id FROM students) t");
allow("case and having", "SELECT tb_id, COUNT(*) c FROM students GROUP BY tb_id HAVING c > 5");
allow("a trailing semicolon is tolerated", "SELECT 1;");
allow(
  "a literal containing a keyword is not a keyword",
  "SELECT cand_name FROM candidates WHERE cand_name = 'delete me'"
);
allow(
  "a column whose name contains a keyword is fine",
  "SELECT std_lms_status, std_added_on FROM students"
);

console.log("\nEvery query is bounded\n");

const bounded = checkSelect("SELECT * FROM students");
check(
  "a LIMIT is added when missing",
  bounded.ok && bounded.sql.endsWith(`LIMIT ${MAX_ROWS}`),
  bounded.ok ? bounded.sql : bounded.reason
);

const alreadyBounded = checkSelect("SELECT * FROM students LIMIT 10");
check(
  "an existing LIMIT is left alone",
  alreadyBounded.ok && !alreadyBounded.sql.includes(String(MAX_ROWS)),
  alreadyBounded.ok ? alreadyBounded.sql : alreadyBounded.reason
);

console.log("\nWriting is refused\n");

refuse("DELETE", "DELETE FROM students");
refuse("UPDATE", "UPDATE students SET std_lms_status = 2");
refuse("INSERT", "INSERT INTO students (std_id) VALUES (1)");
refuse("DROP", "DROP TABLE students");
refuse("TRUNCATE", "TRUNCATE TABLE students");
refuse("ALTER", "ALTER TABLE students ADD COLUMN x INT");
refuse("CREATE", "CREATE TABLE evil (id INT)");
refuse("GRANT", "GRANT ALL ON *.* TO 'x'@'%'");

// The classic: a valid SELECT with something else stapled on.
refuse("a second statement after a semicolon", "SELECT 1; DELETE FROM students");
refuse(
  "a second statement disguised by whitespace",
  "SELECT 1 ;\n\n   DROP TABLE students"
);
refuse("a write hidden in a CTE", "WITH x AS (SELECT 1) DELETE FROM students");
refuse("a write in a subquery position", "SELECT * FROM students WHERE std_id IN (DELETE FROM x)");

console.log("\nComments cannot be used to smuggle anything\n");

// MySQL EXECUTES the contents of /*! */. This is a documented injection route,
// not a theoretical one.
refuse("a MySQL executable comment", "SELECT 1 /*!32302 DROP TABLE students */");
refuse("a line comment", "SELECT 1 -- DROP TABLE students");
refuse("a hash comment", "SELECT 1 # anything");
refuse("a block comment, even an innocent one", "SELECT 1 /* just explaining */");
refuse(
  "a keyword split by a comment",
  "SELECT * FROM students WHERE 1=1 /**/ UNION /**/ SELECT 1"
);

console.log("\nReaching outside the database\n");

refuse("INTO OUTFILE", "SELECT * FROM students INTO OUTFILE '/tmp/x.csv'");
refuse("INTO DUMPFILE", "SELECT 1 INTO DUMPFILE '/tmp/x'");
refuse("LOAD_FILE", "SELECT LOAD_FILE('/etc/passwd')");
refuse("SLEEP", "SELECT SLEEP(30)");
refuse("BENCHMARK", "SELECT BENCHMARK(10000000, MD5('x'))");

console.log("\nSystem tables are not available\n");

refuse("information_schema", "SELECT * FROM information_schema.tables");
refuse("the mysql database", "SELECT user, host FROM mysql.user");
refuse("performance_schema", "SELECT * FROM performance_schema.threads");
refuse("sys", "SELECT * FROM sys.session");

console.log("\nSecrets are not readable\n");

refuse("a password column", "SELECT user_password FROM user");
refuse("a password column via alias", "SELECT u.user_password AS p FROM user u");
refuse("a reset token", "SELECT reset_token FROM user");
refuse("the verification code table", "SELECT * FROM email_verifications");
refuse("the outbox, which holds message bodies", "SELECT * FROM email_outbox");
refuse("login history", "SELECT * FROM login_logs");
// A bare star on the account table would return the hash with everything else.
refuse("SELECT * on the user table", "SELECT * FROM user");
allow(
  "but naming safe columns on the user table is fine",
  "SELECT user_id, user_name, user_email FROM user"
);

console.log("\nSession and transaction state\n");

// A SELECT needs none of these, and they leave the connection changed for
// whatever runs on it next.
refuse("SET", "SET autocommit = 0");
refuse("START TRANSACTION", "START TRANSACTION");
refuse("LOCK TABLES", "LOCK TABLES students READ");
refuse("FOR UPDATE", "SELECT * FROM students FOR UPDATE");
refuse("LOCK IN SHARE MODE", "SELECT * FROM students LOCK IN SHARE MODE");
refuse("USE", "USE mysql");
refuse("a prepared statement", "PREPARE s FROM 'SELECT 1'");
refuse("CALL", "CALL some_procedure()");

console.log("\nThings that are not statements at all\n");

refuse("empty", "");
refuse("whitespace", "   \n  ");
refuse("null", null);
refuse("undefined", undefined);
refuse("prose", "please show me all the students");
refuse("an enormous query", `SELECT ${"a,".repeat(3000)}b FROM x`);

console.log("\nEvery forbidden keyword is actually enforced\n");

// Walks the list rather than restating it, so a keyword added to the guard
// without a test still has to work.
let unenforced = [];
for (const keyword of FORBIDDEN_KEYWORDS) {
  const word = keyword.replace(/_/g, " ");
  const result = checkSelect(`SELECT 1 FROM students ${word} x`);
  if (result.ok) unenforced.push(keyword);
}
check(
  "no keyword in the list slips through",
  unenforced.length === 0,
  unenforced.join(", ")
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
