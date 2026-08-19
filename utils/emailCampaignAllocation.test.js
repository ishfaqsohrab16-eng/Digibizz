/**
 * Regression tests for the campaign quota split.
 *
 * Run with:  node utils/emailCampaignAllocation.test.js
 * Exits non-zero if any rule regresses. No test framework required.
 *
 * The rule under test: a campaign asks for N emails at one center, and N is
 * divided as evenly as possible across that center's courses. The subtle part
 * is supply - a plain N/courses share silently wastes the quota whenever one
 * course has fewer candidates than its share, so the shortfall has to be
 * redistributed over the courses that still have people left.
 */
const { allocateEvenly } = require("./allocateEvenly");

let passed = 0;
let failed = 0;

const check = (name, total, buckets, expected) => {
  const result = allocateEvenly(total, buckets);
  const actual = buckets.map((b) => `${b.key}:${result.get(b.key)}`).join(" ");
  const sum = [...result.values()].reduce((a, b) => a + b, 0);

  // No bucket may ever be allocated more people than it actually has.
  const overrun = buckets.find((b) => result.get(b.key) > b.available);

  if (actual === expected && !overrun) {
    passed += 1;
    console.log(`  PASS  ${name}  ->  ${actual || "(none)"} (total ${sum})`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        expected: ${expected}`);
    console.log(`        actual:   ${actual}`);
    if (overrun) console.log(`        OVERRUN on ${overrun.key}`);
  }
};

const b = (key, available) => ({ key, available });

console.log("\nCampaign quota allocation\n");

check(
  "even split when every course has plenty",
  200,
  [b("digital", 500), b("awe", 500), b("creative", 500)],
  "digital:67 awe:67 creative:66"
);

check(
  "short course does not waste the quota - remainder moves to the others",
  200,
  [b("digital", 500), b("awe", 10), b("creative", 500)],
  "digital:95 awe:10 creative:95"
);

check(
  "asking for more than exists allocates everyone, no more",
  1000,
  [b("digital", 30), b("awe", 10), b("creative", 5)],
  "digital:30 awe:10 creative:5"
);

check("single course takes the whole quota", 50, [b("digital", 500)], "digital:50");

check(
  "remainder smaller than bucket count goes to the largest supplies first",
  2,
  [b("digital", 1), b("awe", 100), b("creative", 100)],
  "digital:0 awe:1 creative:1"
);

check("zero target allocates nothing", 0, [b("digital", 100)], "digital:0");

check(
  "courses with no candidates are skipped entirely",
  10,
  [b("digital", 0), b("awe", 100)],
  "digital:0 awe:10"
);

check("no courses at all does not hang or throw", 10, [], "");

check(
  "two short courses both capped, third absorbs the rest",
  100,
  [b("digital", 5), b("awe", 5), b("creative", 500)],
  "digital:5 awe:5 creative:90"
);

check(
  "the 200/200/100 sequence: a later run splits its own quota the same way",
  100,
  [b("digital", 300), b("awe", 300), b("creative", 300)],
  "digital:34 awe:33 creative:33"
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
