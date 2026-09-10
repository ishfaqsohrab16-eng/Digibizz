/**
 * Regression tests for trainer visibility scoping.
 *
 * Run with:  node utils/trainerScope.test.js
 * Exits non-zero if any rule regresses. No test framework required.
 *
 * The bug this exists to prevent: a trainer teaching Digital at BUITEMS and
 * Creative at UoB must see those two classes and NOT Digital-at-UoB or
 * Creative-at-BUITEMS, which are somebody else's. `IN (centers) AND
 * IN (courses)` matches all four.
 */
const { Op } = require("sequelize");
const {
  distinctClasses,
  allocationScope,
  withAllocationScope,
  allocationCenterIds,
  allocationCourseIds,
  teachesClass,
} = require("./trainerScope");

let passed = 0;
let failed = 0;

const check = (label, actual, predicate) => {
  const ok = typeof predicate === "function" ? predicate(actual) : actual === predicate;
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}\n        got: ${JSON.stringify(actual)}`);
  }
};

const alloc = (center_id, course_id) => ({ center_id, course_id });

/** Does a where-fragment match this row? Mirrors how Sequelize evaluates it. */
const matches = (scope, row) => {
  if (!scope) return false;
  if (scope[Op.or]) return scope[Op.or].some((branch) => matches(branch, row));
  if (scope[Op.and]) return scope[Op.and].every((branch) => matches(branch, row));
  return Object.entries(scope).every(
    ([key, value]) => String(row[key]) === String(value)
  );
};

console.log("\nTrainer visibility scoping\n");

// The scenario from the bug report: one trainer, three online centers.
const threeCenters = [alloc(1, 10), alloc(2, 10), alloc(3, 10)];
const scope3 = allocationScope(threeCenters);

check("all three centers are matched, not just the first", scope3, (s) =>
  [1, 2, 3].every((c) => matches(s, { center_id: c, course_id: 10 }))
);
check("a center the trainer does not teach is excluded", scope3, (s) =>
  !matches(s, { center_id: 4, course_id: 10 })
);

// The cross-product trap.
const twoClasses = [alloc(1, 10), alloc(2, 20)];
const scope2 = allocationScope(twoClasses);

check("their own pairs match", scope2, (s) =>
  matches(s, { center_id: 1, course_id: 10 }) &&
  matches(s, { center_id: 2, course_id: 20 })
);
check(
  "the cross-product pairs do NOT match (center 1 + course 20)",
  scope2,
  (s) => !matches(s, { center_id: 1, course_id: 20 })
);
check(
  "the cross-product pairs do NOT match (center 2 + course 10)",
  scope2,
  (s) => !matches(s, { center_id: 2, course_id: 10 })
);

// Edges.
check("no allocations means NOTHING matches, not everything", allocationScope([]), null);
check("null allocations are handled", allocationScope(null), null);
check("withAllocationScope also returns null with no allocations", withAllocationScope({ tb_id: 9 }, []), null);

const single = allocationScope([alloc(5, 50)]);
check("a single pair needs no OR wrapper", single, (s) => !s[Op.or]);
check("a single pair still matches", single, (s) => matches(s, { center_id: 5, course_id: 50 }));

const duplicated = allocationScope([alloc(1, 10), alloc(1, 10), alloc(2, 20)]);
check("duplicate allocations collapse to one branch each", duplicated[Op.or].length, 2);

// Merging with a caller's own conditions.
const merged = withAllocationScope({ tb_id: 9, sl_status: 0 }, twoClasses);
check("the caller's conditions survive the merge", merged, (m) =>
  matches(m, { tb_id: 9, sl_status: 0, center_id: 1, course_id: 10 })
);
check("a row failing the caller's condition is excluded", merged, (m) =>
  !matches(m, { tb_id: 9, sl_status: 1, center_id: 1, course_id: 10 })
);
check("a row failing the scope is excluded", merged, (m) =>
  !matches(m, { tb_id: 9, sl_status: 0, center_id: 1, course_id: 20 })
);
check(
  "merging uses Op.and so a caller's own Op.or is not clobbered",
  withAllocationScope({ [Op.or]: [{ a: 1 }, { a: 2 }] }, twoClasses),
  (m) => Array.isArray(m[Op.and]) && m[Op.and].length === 2
);

// Helpers.
check("center ids are de-duplicated", allocationCenterIds([alloc(1, 10), alloc(1, 20)]).length, 1);
check("course ids are de-duplicated", allocationCourseIds([alloc(1, 10), alloc(2, 10)]).length, 1);
check("teachesClass accepts a real pair", teachesClass(twoClasses, 2, 20), true);
check("teachesClass rejects a cross-product pair", teachesClass(twoClasses, 2, 10), false);
check("teachesClass tolerates string ids from route params", teachesClass(twoClasses, "1", "10"), true);

// One entry per CLASS, however many allocation rows say so.
//
// The table has no unique key, so the same pair can sit on it twice. Every
// feature that writes a row per allocation then wrote two: assignments did,
// and one piece of work became two entries in the list that deleted together.
const twice = [alloc(1, 10), alloc(1, 10), alloc(2, 20)];
check("a class allocated twice is one class", distinctClasses(twice).length, 2);
check(
  "and the first row is the one kept, so it carries a real id",
  distinctClasses(twice),
  (rows) => rows[0] === twice[0]
);
check("order is preserved", distinctClasses(twice), (rows) => rows[1] === twice[2]);
check(
  "two different classes are both kept",
  distinctClasses([alloc(1, 10), alloc(1, 20)]).length,
  2
);
check(
  "one centre with two courses is two classes, not one",
  distinctClasses([alloc(3, 10), alloc(3, 11)]).length,
  2
);
check("nothing in, nothing out", distinctClasses([]).length, 0);
check("and undefined does not throw", distinctClasses(undefined).length, 0);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
