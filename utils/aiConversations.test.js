/**
 * Regression tests for what the assistant remembers.
 *
 * Run with:  node utils/aiConversations.test.js
 * Exits non-zero if any rule regresses.
 *
 * The bug this exists for: asking "show all that data in a table" right after a
 * chart answered with a sentence and no table. Only the question and the
 * assistant's own summary were carried forward, never the rows, so there was
 * nothing to put in a table and no way to know anything was missing.
 *
 * Re-querying would have been the obvious fix and the wrong one - on CPU-only
 * hardware a round trip is the better part of a minute, and "show me that again
 * differently" should be instant.
 */
process.env.AI_MAX_DATASETS = "3";

const {
  datasetsFor,
  remember,
  forget,
  _store,
} = require("./aiConversations");

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

const dataset = (label) => ({
  sql: `SELECT ${label}`,
  reason: label,
  rowCount: 2,
  ms: 44000,
  rows: [{ a: 1 }, { a: 2 }],
});

console.log("\nCarrying data between turns\n");

_store.clear();

check("a conversation starts empty", datasetsFor("c1").length === 0);

remember("c1", [dataset("enrolment by centre")]);
const carried = datasetsFor("c1");
check("what a turn fetched is kept", carried.length === 1);
// The whole point: the ROWS survive, not just a description of them.
check("with its rows intact", carried[0].rows.length === 2, JSON.stringify(carried[0].rows));
check("and what it was for", carried[0].reason === "enrolment by centre");

remember("c1", [dataset("second")]);
check("a later turn adds to it", datasetsFor("c1").length === 2);

console.log("\nConversations are separate\n");

check("another conversation sees nothing", datasetsFor("c2").length === 0);
remember("c2", [dataset("other")]);
check("and keeps its own", datasetsFor("c2")[0].reason === "other");
check("without disturbing the first", datasetsFor("c1").length === 2);

// No id means no memory, rather than everyone sharing one bucket.
check("no conversation id means no memory", datasetsFor("").length === 0);
check("and remembering against none is not an error", (() => {
  remember("", [dataset("x")]);
  remember(null, [dataset("x")]);
  return true;
})());

console.log("\nIt does not grow without limit\n");

_store.clear();
remember("c3", [dataset("one")]);
remember("c3", [dataset("two")]);
remember("c3", [dataset("three")]);
remember("c3", [dataset("four")]);

const capped = datasetsFor("c3");
check("only the most recent are kept", capped.length === 3, String(capped.length));
// An early exploratory query is rarely what a follow-up is about.
check(
  "and it is the OLDEST that is dropped",
  capped.map((d) => d.reason).join(",") === "two,three,four",
  capped.map((d) => d.reason).join(",")
);

check("an empty batch changes nothing", (() => {
  remember("c3", []);
  return datasetsFor("c3").length === 3;
})());

console.log("\nExpiry\n");

_store.clear();
remember("c4", [dataset("old")]);
// Reach in and age it, rather than waiting an hour.
_store.get("c4").at = Date.now() - 2 * 60 * 60 * 1000;
check("data past its time is gone", datasetsFor("c4").length === 0);

_store.clear();
remember("c5", [dataset("fresh")]);
check("recent data survives", datasetsFor("c5").length === 1);

forget("c5");
check("and can be dropped deliberately", datasetsFor("c5").length === 0);

console.log("\nReading keeps a conversation alive\n");

_store.clear();
remember("c6", [dataset("x")]);
const before = _store.get("c6").at;
// A conversation being actively read should not expire mid-thought.
_store.get("c6").at = before - 1000;
datasetsFor("c6");
check("a read refreshes the timer", _store.get("c6").at > before - 1000);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
