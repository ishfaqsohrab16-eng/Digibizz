/**
 * Tests for which centres need a visit.
 *
 * Run with:  node utils/visitScope.test.js
 * Exits non-zero if any rule regresses. Fake models, no database.
 *
 * Getting this wrong sends a Master Trainer to a building with no class in it,
 * or - worse and quieter - leaves a centre off the list so nobody goes and
 * nobody notices.
 */
process.env.TZ = "Asia/Karachi";

const stub = (request, exports) => {
  const resolved = require.resolve(request);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};

// The fixtures each test writes into.
const state = { allocations: [], centers: [], dates: [] };

const { Op } = require("sequelize");

/**
 * A findAll that honours `where: { center_id: { [Op.in]: [...] } }`.
 *
 * The real query filters in the database, so a double that returned
 * everything would quietly pass a test that the production code fails - it
 * would prove only that the fixture had the right rows in it, which is not a
 * fact about the code at all.
 */
const filtered = (rows) => async (options) => {
  const ids = options?.where?.center_id?.[Op.in];
  if (!Array.isArray(ids)) return rows();
  return rows().filter((row) => ids.includes(Number(row.center_id)));
};

stub("../models/trainersCenterAllocationModel", {
  findAll: async () => state.allocations,
});
stub("../models/center", { findAll: filtered(() => state.centers) });
stub("../models/centersDatesModel", { findAll: filtered(() => state.dates) });

const { centersToVisit, centerToVisit } = require("./visitScope");
const { weekOf } = require("./evaluationWeek");

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

// The report week of Fri 4 Sep 2026 to Thu 10 Sep.
const week = weekOf(new Date(2026, 8, 8));

const setUp = ({ allocations, centers, dates }) => {
  state.allocations = allocations;
  state.centers = centers;
  state.dates = dates || [];
};

const main = async () => {
  console.log("\nOnly centres with a class\n");

  setUp({
    allocations: [{ center_id: 1 }, { center_id: 2 }, { center_id: 1 }],
    centers: [
      { center_id: 1, center_name: "BUITEMS", center_medium: "Physical" },
      { center_id: 2, center_name: "UoB", center_medium: "Physical" },
      // Allocated to nobody this batch. A building, not a centre to visit.
      { center_id: 3, center_name: "GCC", center_medium: "Physical" },
    ],
  });

  let centers = await centersToVisit(10, week);

  check("both taught centres are listed", centers.length === 2, String(centers.length));
  check(
    "a centre with no class is not",
    !centers.some((entry) => entry.center_name === "GCC"),
    centers.map((entry) => entry.center_name).join(", ")
  );

  // One centre with three trainers is one visit, not three.
  check("a centre allocated twice appears once", centers.filter((c) => c.center_id === 1).length === 1);

  check(
    "alphabetically",
    centers.map((entry) => entry.center_name).join(",") === "BUITEMS,UoB",
    centers.map((entry) => entry.center_name).join(",")
  );

  check("no batch means nothing", (await centersToVisit(null, week)).length === 0);
  check("no week means nothing", (await centersToVisit(10, null)).length === 0);

  console.log("\nThe Online Cell\n");

  setUp({
    allocations: [{ center_id: 1 }, { center_id: 4 }, { center_id: 5 }],
    centers: [
      { center_id: 1, center_name: "BUITEMS", center_medium: "Physical" },
      { center_id: 4, center_name: "Evening Online", center_medium: "Online" },
      { center_id: 5, center_name: "Weekend Hybrid", center_medium: "Hybrid" },
    ],
  });

  centers = await centersToVisit(10, week);

  // Two online-ish centres collapse into ONE form. Nobody travels to them, so
  // one Master Trainer files it and that is the whole of it.
  check("online and hybrid become one entry", centers.length === 2, String(centers.length));

  const cell = centers.find((entry) => entry.online_cell);
  check("which is the Online Cell", Boolean(cell));
  check("with id 0, so it cannot collide with a real centre", cell.center_id === 0);
  check("and its own name", cell.center_name === "Online Cell");

  // Last in the list. It is a different kind of thing and belongs at the end
  // rather than sorted into the middle of the real places.
  check("it comes last", centers[centers.length - 1].online_cell === true);
  check("the physical centre is still itself", centers[0].center_name === "BUITEMS");

  // No online or hybrid centre teaching means no Online Cell at all, rather
  // than an empty row somebody has to wonder about.
  setUp({
    allocations: [{ center_id: 1 }],
    centers: [{ center_id: 1, center_name: "BUITEMS", center_medium: "Physical" }],
  });
  centers = await centersToVisit(10, week);
  check("no online centres means no Online Cell", !centers.some((entry) => entry.online_cell));

  console.log("\nEach centre's own dates\n");

  setUp({
    allocations: [{ center_id: 1 }, { center_id: 2 }],
    centers: [
      { center_id: 1, center_name: "BUITEMS", center_medium: "Physical" },
      { center_id: 2, center_name: "UoB", center_medium: "Physical" },
    ],
    dates: [
      // Running through the week in question.
      { center_id: 1, tb_start: "2026-08-19", tb_end: "2026-12-18" },
      // Does not open until October.
      { center_id: 2, tb_start: "2026-10-05", tb_end: "2026-12-18" },
    ],
  });

  centers = await centersToVisit(10, week);

  check("a centre that is running is listed", centers.some((entry) => entry.center_name === "BUITEMS"));

  // A visit report about a centre that has not opened would be a page of
  // blanks, and chasing somebody for it would be worse than useless.
  check(
    "a centre that has not opened is not",
    !centers.some((entry) => entry.center_name === "UoB"),
    centers.map((entry) => entry.center_name).join(", ")
  );

  // By October both are open.
  const october = weekOf(new Date(2026, 9, 13));
  centers = await centersToVisit(10, october);
  check("and appears once it has", centers.length === 2, String(centers.length));

  // A centre missing from the calendar counts as running. An absent record is
  // a gap in the calendar, not evidence nobody taught - and dropping a real
  // centre over it means nobody visits and nobody notices.
  setUp({
    allocations: [{ center_id: 1 }],
    centers: [{ center_id: 1, center_name: "BUITEMS", center_medium: "Physical" }],
    dates: [],
  });
  centers = await centersToVisit(10, week);
  check("a centre with no dates recorded is still visited", centers.length === 1);

  console.log("\nResolving one centre\n");

  setUp({
    allocations: [{ center_id: 1 }, { center_id: 4 }],
    centers: [
      { center_id: 1, center_name: "BUITEMS", center_medium: "Physical" },
      { center_id: 4, center_name: "Evening Online", center_medium: "Online" },
    ],
  });

  check("a real centre resolves", (await centerToVisit(10, week, 1))?.center_name === "BUITEMS");
  check("the Online Cell resolves by id 0", (await centerToVisit(10, week, 0))?.online_cell === true);

  // A centre id in a request body is a number the browser chose. Resolving it
  // against the list is what stops a visit being filed for a centre that had
  // no class - or for one hidden inside the Online Cell, which has no form of
  // its own.
  check("a centre with no class does not", (await centerToVisit(10, week, 99)) === null);
  check(
    "nor does an online centre by its real id",
    (await centerToVisit(10, week, 4)) === null,
    "an online centre is only reachable as the Online Cell"
  );
  check("nothing resolves to nothing", (await centerToVisit(10, week, undefined)) === null);
};

main().then(() => {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
});
