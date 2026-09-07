const { sequelize } = require("../config/db");
const { FORBIDDEN_TABLES, FORBIDDEN_COLUMNS } = require("./sqlGuard");

/**
 * The map of the database handed to the assistant.
 *
 * Read from information_schema rather than from the Sequelize models, because
 * the models describe what the application expects and the database describes
 * what is actually there. Where they disagree - a column added by a migration
 * that never made it into a model, a table nobody removed - a query written
 * from the models would fail and the assistant would have no idea why.
 *
 * Cached: this changes on deploys, not between questions, and re-reading a
 * hundred tables for every message would make the first token slow for no
 * reason.
 */

/** How long a read of the schema stays good. */
const CACHE_MS = Number(process.env.AI_SCHEMA_CACHE_MS) || 10 * 60 * 1000;

let cache = { at: 0, text: null, tables: null };

/**
 * Tables worth describing.
 *
 * Bookkeeping the assistant has no business reading is excluded here as well
 * as in the guard. The guard is what enforces it; this just avoids advertising
 * tables the model would then be refused for using, which wastes a turn and
 * teaches it nothing.
 */
const isHidden = (table) =>
  FORBIDDEN_TABLES.includes(table) ||
  table.startsWith("sequelize") ||
  table === "brevo_contacts" ||
  table === "email_send_quota";

const isHiddenColumn = (column) =>
  FORBIDDEN_COLUMNS.includes(String(column).toLowerCase());

/**
 * Read the shape of the database.
 *
 * Returns a compact text description - one line per table - rather than JSON.
 * The model reads this as part of its prompt, and prose costs fewer tokens than
 * a nested object saying the same thing, which matters when the whole schema
 * has to fit alongside the conversation.
 */
const describeSchema = async ({ force = false } = {}) => {
  if (!force && cache.text && Date.now() - cache.at < CACHE_MS) {
    return cache;
  }

  const [rows] = await sequelize.query(
    `SELECT TABLE_NAME AS table_name,
            COLUMN_NAME AS column_name,
            DATA_TYPE   AS data_type,
            COLUMN_KEY  AS column_key
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME, ORDINAL_POSITION`
  );

  const tables = new Map();
  for (const row of rows) {
    if (isHidden(row.table_name)) continue;
    if (isHiddenColumn(row.column_name)) continue;

    if (!tables.has(row.table_name)) tables.set(row.table_name, []);
    tables.get(row.table_name).push({
      name: row.column_name,
      type: row.data_type,
      key: row.column_key,
    });
  }

  const lines = [];
  for (const [table, columns] of tables) {
    const described = columns
      .map((column) => {
        // The key marker is what lets the model guess joins correctly. Without
        // it, it invents plausible-looking foreign keys that do not exist.
        const marker = column.key === "PRI" ? " PK" : column.key === "MUL" ? " FK" : "";
        return `${column.name} ${column.type}${marker}`;
      })
      .join(", ");
    lines.push(`${table}(${described})`);
  }

  const text = lines.join("\n");
  cache = { at: Date.now(), text, tables: [...tables.keys()] };
  return cache;
};

module.exports = { describeSchema, CACHE_MS };
