/**
 * Regression tests for the assistant's handling of what the model says.
 *
 * Run with:  node controllers/aiAssistant.test.js
 * Exits non-zero if any rule regresses. No database, no model.
 *
 * A language model is an unreliable narrator by construction. It sends tool
 * arguments that are not quite JSON, references columns that are not in the
 * result, and asks for charts of data it never fetched. None of that should
 * reach the screen as a blank box or a crash, so the parsing and the repair
 * are tested as the messy inputs they actually receive.
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

stub("../servec/providers/analyst", {
  chat: async () => ({ message: {}, model: "test", provider: "groq" }),
  screenPrompt: async () => ({ flagged: false, score: 0 }),
  health: async () => ({ present: true, providers: {}, catalogue: [] }),
  budgetReport: () => [],
  CATALOGUE: [],
});
stub("../servec/providers/groq", { SCREEN_MODEL: "guard" });
stub("../utils/dbSchema", {
  describeSchema: async () => ({ text: "", index: "", tables: [] }),
  describeTables: async () => "",
});
stub("../utils/aiReadOnlyDb", {
  runQuery: async () => ({ rows: [], ms: 0 }),
  hasOwnAccount: true,
  missingPassword: false,
});
stub("../utils/aiConversations", { datasetsFor: () => [], remember: () => {} });

const { _internals } = require("./aiAssistantController");
const { parseArguments, repairVisuals, summariseRows } = _internals;

console.log("\nReading the arguments of a tool call\n");

// Tool arguments arrive as a JSON STRING, which is usually valid and
// occasionally is not.
check(
  "a normal call",
  parseArguments('{"sql":"SELECT 1","reason":"check"}')?.sql === "SELECT 1"
);
check("no arguments is an empty object, not a failure", parseArguments("")?.sql === undefined);
check("undefined is handled", parseArguments(undefined) !== null);
check("truncated JSON yields nothing", parseArguments('{"sql":') === null);
check("prose yields nothing", parseArguments("I think we should query") === null);
// Valid JSON, wrong shape - it must not be treated as arguments.
check("a bare array is not arguments", parseArguments("[1,2,3]") !== null);
check("a bare number is not arguments", parseArguments("42") === null);

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

console.log("\nEvery chart type the model may pick\n");

// One label and one number: pie, donut, treemap, funnel, radial, list.
for (const type of ["donut", "treemap", "funnel", "radial", "list"]) {
  const kept = repairVisuals(
    [{ type, title: type, queryIndex: 1, labelField: "center_name", valueField: "students" }],
    results
  );
  check(`${type} is kept`, kept[0]?.type === type, JSON.stringify(kept));
}

// x against one or more series: bar, hbar, stackedBar, line, area, radar.
for (const type of ["hbar", "stackedBar", "area", "radar"]) {
  const kept = repairVisuals(
    [{ type, title: type, queryIndex: 1, xField: "center_name", yFields: ["students"] }],
    results
  );
  check(`${type} is kept`, kept[0]?.type === type, JSON.stringify(kept));
}

const scatter = repairVisuals(
  [
    {
      type: "scatter",
      title: "x",
      queryIndex: 1,
      xField: "students",
      yFields: ["students"],
    },
  ],
  results
);
check("scatter is kept", scatter[0]?.type === "scatter", JSON.stringify(scatter));

// The same guarantee as before, across the new types: a chart of a column
// that is not there becomes a table rather than an empty box.
for (const type of ["donut", "treemap", "funnel", "radial"]) {
  const kept = repairVisuals(
    [{ type, title: type, queryIndex: 0, labelField: "nope", valueField: "also_nope" }],
    results
  );
  check(
    `${type} with missing fields falls back to something renderable`,
    kept.length === 1 && kept[0].labelField !== "nope",
    JSON.stringify(kept)
  );
}

// Casing varies between models and the renderer switches on an exact string.
for (const written of ["stackedbar", "StackedBar", "stacked_bar", "DONUT", "HorizontalBar"]) {
  const kept = repairVisuals(
    [{ type: written, title: written, queryIndex: 1, xField: "center_name", yFields: ["students"], labelField: "center_name", valueField: "students" }],
    results
  );
  check(`"${written}" is understood`, kept[0]?.type !== "table", JSON.stringify(kept));
}

const badStacked = repairVisuals(
  [{ type: "stackedBar", title: "x", queryIndex: 1, xField: "nope", yFields: ["students"] }],
  results
);
check("a stacked bar with no x becomes a table", badStacked[0]?.type === "table");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
