/**
 * Tests for rolling back without making things worse.
 *
 * Run with:  node utils/safeRollback.test.js
 * Exits non-zero if any rule regresses. No database.
 *
 * Every rule here is the crash that produced the module: a second rollback
 * inside a catch block threw, and because Express never awaits a handler, the
 * unhandled rejection ended the process.
 */

const { safeRollback } = require("./safeRollback");

let passed = 0;
let failed = 0;

const check = (name, condition, detail) => {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail !== undefined ? `  ->  ${JSON.stringify(detail)}` : ""}`);
  }
};

const fake = (finished) => {
  const calls = [];
  return {
    finished,
    calls,
    rollback: async () => {
      calls.push("rollback");
    },
  };
};

const main = async () => {
  console.log("\nRolling back a transaction that is still open\n");

  const open = fake(undefined);
  const rolled = await safeRollback(open);
  check("it rolls back", open.calls.length === 1);
  check("and says it did", rolled === true);

  console.log("\nA transaction that has already finished\n");

  // The crash exactly: rollback, answer the request, something in the
  // response throws, and the catch rolls back a second time.
  const already = fake("rollback");
  check("a rolled-back transaction is left alone", (await safeRollback(already)) === false);
  check("and not touched again", already.calls.length === 0, already.calls);

  const committed = fake("commit");
  check("a committed transaction is left alone", (await safeRollback(committed)) === false);
  check("and not touched again", committed.calls.length === 0, committed.calls);

  console.log("\nNothing to roll back\n");

  check("undefined is fine", (await safeRollback(undefined)) === false);
  check("null is fine", (await safeRollback(null)) === false);

  console.log("\nA rollback that fails\n");

  // The caller is already handling an error. Losing that error to a second
  // one thrown from the cleanup is the outcome this exists to prevent.
  const broken = {
    finished: undefined,
    rollback: async () => {
      throw new Error("Connection lost");
    },
  };

  let threw = false;
  let result = null;
  try {
    result = await safeRollback(broken);
  } catch {
    threw = true;
  }

  check("it does not throw", !threw);
  check("and reports the failure instead", result === false);
};

main().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
});
