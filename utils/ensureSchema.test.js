/**
 * Tests for reconciling a deployed schema with what the models expect.
 *
 * Run with:  node utils/ensureSchema.test.js
 * Exits non-zero if any rule regresses. No database - a fake connection
 * records the SQL that would have been run.
 *
 * This module exists because sequelize.sync({alter:false}) creates missing
 * TABLES and never touches an existing one. Every entry in it is a real
 * production failure, and the most recent crash-looped the whole server: a
 * unique index over a column sync had never added.
 */

const queries = [];
let answer = () => [[]];

// Stubbed before the module under test is required, so it never opens a socket.
const dbPath = require.resolve("../config/db");
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    sequelize: {
      query: async (sql, options) => {
        queries.push({ sql: String(sql).replace(/\s+/g, " ").trim(), options });
        return answer(sql, options);
      },
    },
  },
};

const { FORBIDDEN_INDEXES, REQUIRED_COLUMNS, _internals } = require("./ensureSchema");
const { dropForbiddenIndexes } = _internals;

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

const reset = () => {
  queries.length = 0;
};

const main = async () => {
  console.log("\nThe column that crash-looped the server\n");

  // weekly_evaluations was deployed keyed on (trainer, week), then corrected to
  // include the batch. The table already existed, sync never adds a column, and
  // the index build failed on every boot:
  //   ER_KEY_COLUMN_DOES_NOT_EXITS: Key column 'tb_id' doesn't exist in table
  const tbId = REQUIRED_COLUMNS.find(
    (item) => item.table === "weekly_evaluations" && item.column === "tb_id"
  );

  check("it is declared, so ensureSchema adds it before sync runs", Boolean(tbId));
  check("as an INT", /^INT\b/i.test(tbId.definition), tbId.definition);

  // The ALTER has to succeed whatever is already stored. Without a default,
  // adding a NOT NULL column to a table with rows in it is rejected - and the
  // server would still not boot.
  check("NOT NULL, matching the model", /NOT NULL/i.test(tbId.definition));
  check(
    "with a default, so the ALTER cannot fail on existing rows",
    /DEFAULT 0/i.test(tbId.definition)
  );
  check("and names its migration", /migration\/\d+/.test(tbId.migration || ""));

  console.log("\nDropping an index that has become wrong\n");

  const stale = FORBIDDEN_INDEXES.find(
    (item) => item.index === "weekly_evaluations_trainer_week"
  );
  check("the superseded unique index is listed", Boolean(stale));
  check("and says why it must go", /two batches/.test(stale.reason), stale.reason);

  // It must LOOK before it drops. DROP INDEX on one that is not there is an
  // error, and on a database that never ran the first version that would be an
  // error on every single boot, forever.
  reset();
  answer = () => [[{ present: 0 }]];
  await dropForbiddenIndexes();

  check(
    "information_schema is consulted first",
    /information_schema.STATISTICS/i.test(queries[0]?.sql || ""),
    queries[0]?.sql
  );
  check(
    "and nothing is dropped when the index is absent",
    !queries.some((entry) => /DROP INDEX/i.test(entry.sql)),
    queries.map((entry) => entry.sql).join(" | ")
  );

  // When it IS there, it goes.
  reset();
  answer = () => [[{ present: 1 }]];
  await dropForbiddenIndexes();

  const dropped = queries.find((entry) => /DROP INDEX/i.test(entry.sql));
  check("an index that exists is dropped", Boolean(dropped), queries.map((e) => e.sql).join(" | "));
  check(
    "by name, on the right table",
    /ALTER TABLE `weekly_evaluations` DROP INDEX `weekly_evaluations_trainer_week`/.test(
      dropped?.sql || ""
    ),
    dropped?.sql
  );

  // A failure here must not stop the boot. The whole point of the change around
  // it is that a schema problem is not worth taking the server down for.
  reset();
  answer = (sql) => {
    if (/information_schema/i.test(sql)) return [[{ present: 1 }]];
    throw new Error("Access denied for user");
  };

  let threw = false;
  try {
    await dropForbiddenIndexes();
  } catch {
    threw = true;
  }
  check("a refused DROP is logged, not thrown", !threw);
};

main().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
});
