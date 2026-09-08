/**
 * Tests for who is evaluated, and over which weeks.
 *
 * Run with:  node utils/evaluationScope.test.js
 * Exits non-zero if any rule regresses. No database.
 *
 * Centres inside one batch do not share dates - they start when they are
 * ready - and almost every case here is a consequence of that. Getting it
 * wrong offers a Master Trainer a week nobody taught, or hides a week somebody
 * did.
 */
process.env.TZ = "Asia/Karachi";

const stub = (request, exports) => {
  const resolved = require.resolve(request);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};

stub("../models/trainersCenterAllocationModel", {});
stub("../models/centersDatesModel", {});

const { weeksInWindow, isInWindow, classesActiveIn } = require("./evaluationScope");
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

// Tuesday 8 September 2026 is "now" throughout.
const now = new Date(2026, 8, 8);

console.log("\nWhich weeks a batch offers\n");

// A batch that started on a Wednesday and is still running.
const running = { start: "2026-08-19", end: "2026-12-18", byCentre: {} };
const weeks = weeksInWindow(running, now);

check("the current week is offered", weeks[0]?.start === "2026-09-04", weeks[0]?.start);

// The batch began on Wednesday 19 August, inside the report week that started
// on Friday 14 August. That week had teaching days in it and needs a report;
// requiring the whole week inside the window would drop it.
const first = weeks[weeks.length - 1];
check("the week teaching began in is included", first.start === "2026-08-14", first.start);
check("and nothing earlier", weeks.every((week) => week.end >= running.start));

// The batch runs until December, but weeks that have not happened cannot be
// reported on - a report filed in advance is a guess with signatures on it.
check("no week after this one", weeks.every((week) => week.start <= "2026-09-07"));

console.log("\nA batch that has finished\n");

const finished = { start: "2026-01-06", end: "2026-03-20", byCentre: {} };
const past = weeksInWindow(finished, now);

check("its weeks are still offered", past.length > 0, String(past.length));
check("the newest is the last teaching week", past[0]?.start === "2026-03-20", past[0]?.start);
check("nothing after it ended", past.every((week) => week.start <= finished.end));

console.log("\nA batch that has not started\n");

// Everything about this batch is in the future.
const future = { start: "2026-11-02", end: "2027-01-15", byCentre: {} };
check("offers no weeks at all", weeksInWindow(future, now).length === 0);

// Nobody has filled the centre calendar in. That is a real state and must not
// silently become "every week since January".
check("no dates means no weeks", weeksInWindow(null, now).length === 0);

console.log("\nWhether one week is in the window\n");

const thisWeek = weekOf(now);
check("a week inside", isInWindow(thisWeek, running));
check("a week before", !isInWindow(weekOf(new Date(2026, 6, 1)), running));
check("a week after", !isInWindow(weekOf(new Date(2027, 1, 1)), running));

// Overlap, not containment. The week teaching started in counts.
check(
  "a week teaching started part-way through",
  isInWindow(weekOf(new Date(2026, 7, 19)), running)
);
check("no window means no", !isInWindow(thisWeek, null));
check("no week means no", !isInWindow(null, running));

console.log("\nWhich centres were running that week\n");

// The case the whole per-centre calendar exists for: one batch, two centres,
// different start dates. In the week of 7 September, BUITEMS has been running
// for weeks and UoB has not opened.
const window = {
  start: "2026-08-19",
  end: "2026-12-18",
  byCentre: {
    1: { start: "2026-08-19", end: "2026-12-18" }, // BUITEMS
    2: { start: "2026-10-05", end: "2026-12-18" }, // UoB, starting later
  },
};

const classes = [
  { center_id: 1, course_id: 3, tb_id: 10, center_name: "BUITEMS" },
  { center_id: 2, course_id: 3, tb_id: 10, center_name: "UoB" },
];

const marked = classesActiveIn(classes, thisWeek, window);

check("both classes are still listed", marked.length === 2);
check("the one that had started is active", marked[0].active === true);

// Asking a Master Trainer to grade a class that had not begun is asking them
// to make something up.
check("the one that had not is marked inactive", marked[1].active === false);
check("and carries its own dates, so the form can say why", marked[1].dates?.start === "2026-10-05");

// By December both are running.
const december = classesActiveIn(classes, weekOf(new Date(2026, 11, 7)), window);
check("both are active once both have started", december.every((entry) => entry.active));

// A centre missing from the calendar counts as running. An absent record is a
// gap in the calendar, not evidence that nobody taught - and hiding a real
// class over it would be the worse mistake.
const unknown = classesActiveIn(
  [{ center_id: 99, course_id: 3, tb_id: 10 }],
  thisWeek,
  window
);
check("a centre with no dates is assumed to be running", unknown[0].active === true);
check("and says it has no dates", unknown[0].dates === null);

check("no classes is an empty list, not a crash", classesActiveIn(null, thisWeek, window).length === 0);
check("no window leaves everything active", classesActiveIn(classes, thisWeek, null).every((c) => c.active));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
