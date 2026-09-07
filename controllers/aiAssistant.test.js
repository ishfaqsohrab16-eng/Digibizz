/**
 * Regression tests for the assistant's handling of what the model says.
 *
 * Run with:  node controllers/aiAssistant.test.js
 * Exits non-zero if any rule regresses. No database, no model.
 *
 * A language model is an unreliable narrator by construction. It wraps JSON in
 * markdown fences it was told not to use, references columns that are not in
 * the result, and asks for charts of data it did not fetch. None of that should
 * reach the screen as a blank box or a crash, so the parsing and the repair are
 * tested as the messy inputs they actually receive.
 */
const stub = (request, exports) => {
  const resolved = require.resolve(request);
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports,
  };
};

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

stub("../servec/providers/ollama", {
  chat: async () => "{}",
  health: async () => ({ ok: true, present: true }),
  MODEL: "test",
  BASE_URL: "http://test",
  OllamaError: Error,
});
stub("../utils/dbSchema", { describeSchema: async () => ({ text: "", tables: [] }) });
stub("../utils/aiReadOnlyDb", { runQuery: async () => ({ rows: [], ms: 0 }), hasOwnAccount: true });

const { _internals } = require("./aiAssistantController");
const { parseReply, repairVisuals, summariseRows } = _internals;

console.log("\nReading what the model actually returned\n");

check(
  "plain JSON",
  parseReply('{"action":"answer","summary":"hi"}')?.summary === "hi"
);

// Told not to use fences. Uses fences.
check(
  "a fenced block",
  parseReply('```json\n{"action":"answer","summary":"hi"}\n```')?.summary === "hi"
);
check(
  "a fence without the language",
  parseReply('```\n{"action":"answer","summary":"hi"}\n```')?.summary === "hi"
);

// Told to reply with the object and nothing else. Adds a sentence.
check(
  "an object buried in a sentence",
  parseReply('Sure! Here you go: {"action":"answer","summary":"hi"} Hope that helps.')
    ?.summary === "hi"
);

check("prose alone yields nothing", parseReply("I am not sure what you mean") === null);
check("empty yields nothing", parseReply("") === null);
check("null yields nothing", parseReply(null) === null);
check("broken JSON yields nothing", parseReply('{"action":') === null);
// A bare array is valid JSON but not the contract.
check("a JSON array is not an object we can use", parseReply("[1,2,3]")?.action === undefined);

console.log("\nRows shown to the model\n");

check("no rows says so", summariseRows([]) === "no rows");
check(
  "a small result is passed whole",
  summariseRows([{ a: 1 }]) === '[{"a":1}]'
);

const many = Array.from({ length: 200 }, (_, i) => ({ i }));
const summarised = summariseRows(many);
check(
  "a large result is trimmed",
  summarised.length < JSON.stringify(many).length,
  `${summarised.length} vs ${JSON.stringify(many).length}`
);
check(
  "and the model is told how many there really were",
  /200 rows in total/.test(summarised),
  summarised.slice(-80)
);

console.log("\nRepairing the charts it asks for\n");

const results = [
  { rows: [{ total: 42 }] },
  {
    rows: [
      { center_name: "Quetta", students: 120 },
      { center_name: "Turbat", students: 80 },
    ],
  },
  { rows: [] },
];

let visuals = repairVisuals(
  [{ type: "bar", title: "By centre", queryIndex: 1, xField: "center_name", yFields: ["students"] }],
  results
);
check("a correct bar chart is kept", visuals[0]?.type === "bar", JSON.stringify(visuals));

// The failure that matters: a chart of a column that is not there renders an
// empty box with a confident title. Becoming a table keeps the information.
visuals = repairVisuals(
  [{ type: "bar", title: "By centre", queryIndex: 1, xField: "nope", yFields: ["students"] }],
  results
);
check(
  "a bar chart naming a missing x field becomes a table",
  visuals[0]?.type === "table",
  JSON.stringify(visuals)
);

visuals = repairVisuals(
  [{ type: "bar", title: "x", queryIndex: 1, xField: "center_name", yFields: ["missing"] }],
  results
);
check("a missing y field becomes a table too", visuals[0]?.type === "table");

visuals = repairVisuals(
  [{ type: "pie", title: "x", queryIndex: 1, labelField: "center_name", valueField: "students" }],
  results
);
check("a correct pie is kept", visuals[0]?.type === "pie");

visuals = repairVisuals(
  [{ type: "pie", title: "x", queryIndex: 1, labelField: "center_name" }],
  results
);
check("a pie with no value field becomes a table", visuals[0]?.type === "table");

// yField singular is a natural thing to write, and costs a round to correct.
visuals = repairVisuals(
  [{ type: "line", title: "x", queryIndex: 1, xField: "center_name", yField: "students" }],
  results
);
check(
  "the singular yField is accepted as well as yFields",
  visuals[0]?.type === "line" && visuals[0]?.yFields?.[0] === "students",
  JSON.stringify(visuals)
);

visuals = repairVisuals(
  [{ type: "stat", title: "Total", queryIndex: 0, valueField: "total" }],
  results
);
check("a stat is kept", visuals[0]?.type === "stat");

visuals = repairVisuals([{ type: "stat", title: "Total", queryIndex: 0 }], results);
check(
  "a stat with no field named falls back to the first column",
  visuals[0]?.valueField === "total",
  JSON.stringify(visuals)
);

console.log("\nCharts of data that is not there\n");

// Asking for query 7 when three were run. Silently rendering nothing would be
// the model getting away with inventing a figure.
check(
  "a visual pointing at a query that was never run is dropped",
  repairVisuals([{ type: "table", queryIndex: 7 }], results).length === 0
);
check(
  "a visual over an empty result is dropped",
  repairVisuals([{ type: "table", queryIndex: 2 }], results).length === 0
);
check("visuals that are not objects are dropped", repairVisuals([null, 5, "x"], results).length === 0);
check("a missing visuals list is not an error", repairVisuals(undefined, results).length === 0);
check("a non-list is not an error", repairVisuals("table", results).length === 0);

// An unrecognised type is still data worth showing.
check(
  "an unknown chart type becomes a table",
  repairVisuals([{ type: "sankey", queryIndex: 1 }], results)[0]?.type === "table"
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
