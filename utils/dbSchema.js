const { sequelize } = require("../config/db");
const { FORBIDDEN_TABLES, FORBIDDEN_COLUMNS } = require("./sqlGuard");

/**
 * The map of the database handed to the assistant.
 *
 * Read from information_schema rather than from the Sequelize models, because
 * the models describe what the application expects and the database describes
 * what is actually there. Where they disagree - a column added by a migration
 * that never made it into a model - a query written from the models fails and
 * the assistant has no idea why.
 *
 * Three things go into the prompt, and the second and third matter more than
 * the first:
 *
 *   COLUMNS       - what exists.
 *   RELATIONSHIPS - how tables actually join. Without the real foreign keys a
 *                   model invents plausible-looking ones (students.centre_id,
 *                   center.id) and every join is subtly wrong.
 *   GLOSSARY      - what the words mean HERE. No amount of schema tells a model
 *                   that a candidate is an applicant and a student is somebody
 *                   who was enrolled, or that recommended = 'Yes' is the
 *                   interview outcome. That is where "understand what I meant"
 *                   actually comes from.
 *
 * Cached, because this changes on deploys and not between questions.
 */

const CACHE_MS = Number(process.env.AI_SCHEMA_CACHE_MS) || 10 * 60 * 1000;

let cache = { at: 0, text: null, tables: null, detail: null };

/**
 * What the words mean in this database.
 *
 * Hand-written, because it is the part that cannot be introspected. Every line
 * here is a mistake the assistant would otherwise make: counting applicants as
 * students, treating a trainer's centres and courses as a cross product,
 * averaging marks stored as text.
 */
const GLOSSARY = `WHAT THE WORDS MEAN HERE
- A CANDIDATE (candidates) is an APPLICANT. They applied to a batch and may
  never have been accepted. A STUDENT (students) is somebody who was ENROLLED.
  "How many students" almost never means candidates, and vice versa.
- candidates.recommended = 'Yes' means the interview panel recommended them.
  Anything else means they were not. It is a string, not a boolean.
- students.std_lms_status = 2 means the student was REMOVED. Exclude them from
  counts of current students unless asked otherwise.
- A BATCH (training_batches, tb_id) is an intake, named like "Batch 10". Almost
  every question is about one batch. If none is named, use the most recent
  tb_id, and say in your answer which batch you used.
- A CENTRE is a physical training location (centers.center_name). A COURSE is a
  track (courses.course_full_name, e.g. Graphic Design with AI). A CLASS is a
  (centre, course, batch) combination - that is the real unit teaching happens
  in.
- trainers_center_allocation lists which trainer teaches which class. The rows
  are (center_id, course_id) PAIRS. Never treat a trainer's centres and courses
  as a cross product: a trainer teaching Digital at BUITEMS and Creative at UoB
  does NOT teach Digital at UoB.
- user holds the login account. students.user_id and trainers.user_id point at
  it; a person's NAME lives in user.user_name, not in students.
- Marks in assignment_submissions.obt_marks are stored as TEXT. Cast before
  doing arithmetic: AVG(CAST(obt_marks AS DECIMAL(6,2))).
- assignment_submissions.as_submission_status: 0 submitted, 1 marked,
  2 returned for rework.
- std_gender is 'Male', 'Female' or 'Other'.
- Dates: candidates.cand_apply_date is when they applied; students.std_added_on
  is when they were enrolled; assignments.as_deadline is text, not a DATE.`;

const isHidden = (table) =>
  FORBIDDEN_TABLES.includes(table) ||
  table.startsWith("sequelize") ||
  table === "brevo_contacts" ||
  table === "email_send_quota" ||
  table === "email_outbox";

const isHiddenColumn = (column) =>
  FORBIDDEN_COLUMNS.includes(String(column).toLowerCase());

/**
 * Read the shape of the database.
 *
 * Returns a compact text description - the model reads this as part of its
 * prompt, and prose costs fewer tokens than a nested object saying the same
 * thing.
 */
const describeSchema = async ({ force = false } = {}) => {
  if (!force && cache.text && Date.now() - cache.at < CACHE_MS) {
    return cache;
  }

  // Three reads, in parallel: what exists, how it joins, and how much of it
  // there is.
  const [[columns], [foreignKeys], [counts]] = await Promise.all([
    sequelize.query(
      `SELECT TABLE_NAME AS t, COLUMN_NAME AS c, DATA_TYPE AS d, COLUMN_KEY AS k
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        ORDER BY TABLE_NAME, ORDINAL_POSITION`
    ),
    sequelize.query(
      `SELECT TABLE_NAME AS t, COLUMN_NAME AS c,
              REFERENCED_TABLE_NAME AS rt, REFERENCED_COLUMN_NAME AS rc
         FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND REFERENCED_TABLE_NAME IS NOT NULL`
    ),
    // TABLE_ROWS is an estimate on InnoDB, which is fine and is why it is
    // labelled approximate below. Counting every table exactly would mean a
    // full scan of each one on every cache miss.
    sequelize.query(
      `SELECT TABLE_NAME AS t, TABLE_ROWS AS n
         FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()`
    ),
  ]);

  const rowCounts = new Map(counts.map((row) => [row.t, Number(row.n) || 0]));

  const tables = new Map();
  for (const row of columns) {
    if (isHidden(row.t) || isHiddenColumn(row.c)) continue;
    if (!tables.has(row.t)) tables.set(row.t, []);
    tables.get(row.t).push({ name: row.c, type: row.d, key: row.k });
  }

  const lines = [];
  for (const [table, cols] of tables) {
    const described = cols
      .map((column) => {
        // The key marker is what lets the model guess joins correctly.
        const marker =
          column.key === "PRI" ? " PK" : column.key === "MUL" ? " FK" : "";
        return `${column.name} ${column.type}${marker}`;
      })
      .join(", ");
    const size = rowCounts.get(table);
    const scale = size ? ` -- ~${size} rows` : "";
    lines.push(`${table}(${described})${scale}`);
  }

  // The real join paths. Declared foreign keys only - anything inferred from
  // matching column names would be a guess presented as fact.
  const joins = foreignKeys
    .filter((row) => !isHidden(row.t) && !isHidden(row.rt))
    .map((row) => `${row.t}.${row.c} -> ${row.rt}.${row.rc}`);

  const relationships = joins.length
    ? `\n\nRELATIONSHIPS (declared foreign keys)\n${[...new Set(joins)].join("\n")}`
    : "\n\nRELATIONSHIPS\nNone are declared in the database. Join on the matching id columns - center_id, course_id, tb_id, user_id, std_rollno - and check your results look sane.";

  const text = `${lines.join("\n")}${relationships}\n\n${GLOSSARY}`;

  // The INDEX is what every request carries: one line per table, name and
  // size only. The full listing above is ~2,500 tokens, which on an 8,000
  // tokens-per-minute allowance meant a single two-round question was over
  // budget before the question was even read. The index is a tenth of that,
  // and the assistant asks for the columns of the handful of tables it
  // actually needs.
  const index = [...tables.keys()]
    .map((table) => {
      const size = rowCounts.get(table);
      return size ? `${table} (~${size})` : table;
    })
    .join(", ");

  // Per-table detail, ready to hand over when it is asked for.
  const detail = new Map();
  for (const [table, cols] of tables) {
    const described = cols
      .map((column) => {
        const marker =
          column.key === "PRI" ? " PK" : column.key === "MUL" ? " FK" : "";
        return `${column.name} ${column.type}${marker}`;
      })
      .join(", ");

    const links = foreignKeys
      .filter((row) => row.t === table || row.rt === table)
      .map((row) => `${row.t}.${row.c} -> ${row.rt}.${row.rc}`);

    detail.set(
      table,
      `${table}(${described})${
        links.length
          ? `\n  joins: ${[...new Set(links)].join("; ")}`
          : ""
      }`
    );
  }

  cache = {
    at: Date.now(),
    text,
    index: `${index}\n\n${GLOSSARY}`,
    tables: [...tables.keys()],
    detail,
  };
  return cache;
};

/**
 * The columns and joins of specific tables.
 *
 * Answers the assistant's describe_tables tool. Unknown names come back
 * named rather than silently dropped - a model that asked for `centres` and
 * got nothing would assume the table does not exist, when the table is
 * `centers`.
 */
const describeTables = async (names) => {
  const { detail, tables } = await describeSchema();
  const wanted = (Array.isArray(names) ? names : [names])
    .map((name) => String(name || "").trim())
    .filter(Boolean)
    .slice(0, 8);

  const found = [];
  const missing = [];

  for (const name of wanted) {
    if (detail.has(name)) found.push(detail.get(name));
    else missing.push(name);
  }

  const suggestions = missing.length
    ? `\n\nNot found: ${missing.join(", ")}. Available tables: ${tables.join(", ")}`
    : "";

  return `${found.join("\n")}${suggestions}`;
};

module.exports = { describeSchema, describeTables, GLOSSARY, CACHE_MS };
