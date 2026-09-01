/**
 * Regression tests for who may do what with an assignment.
 *
 * Run with:  node utils/assignmentAccess.test.js
 * Exits non-zero if any rule regresses. No database.
 *
 * The module had no authorisation at all. Every rule below closes something
 * that was open:
 *
 *   - the assignment routes were unauthenticated outright, so anyone could
 *     delete an assignment and every submission against it,
 *   - identity came from `?user_id=`, so one person could read another's list,
 *   - marking had no check, so a student could grade their own work,
 *   - and when a viewer's record could not be found the scope was left off
 *     entirely, so a MISSING record granted more access than a present one.
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

const db = { trainers: [], students: [], allocations: [] };

const matches = (row, where) =>
  Object.entries(where || {}).every(
    ([key, value]) => String(row[key]) === String(value)
  );

stub("../models/trainersModel", {
  async findOne({ where }) {
    return db.trainers.find((row) => matches(row, where)) || null;
  },
});
stub("../models/studentModel", {
  async findOne({ where }) {
    return db.students.find((row) => matches(row, where)) || null;
  },
});
stub("../models/trainersCenterAllocationModel", {
  async findAll({ where }) {
    return db.allocations.filter((row) => matches(row, where));
  },
});

const {
  resolveViewer,
  assignmentScopeFor,
  canManageAssignment,
  canMarkSubmission,
  canReadSubmission,
  belongsToStudent,
} = require("./assignmentAccess");

const assignment = {
  as_id: 1,
  t_id: 7,
  tb_id: 10,
  center_id: 3,
  course_id: 2,
};

(async () => {
  console.log("\nResolving who is asking\n");

  db.trainers = [{ t_id: 7, user_id: 100 }];
  db.allocations = [
    { t_id: 7, tb_id: 10, center_id: 3, course_id: 2 },
    { t_id: 7, tb_id: 10, center_id: 4, course_id: 2 },
  ];
  db.students = [
    { std_id: 1, user_id: 200, std_rollno: "DB10-1", tb_id: 10, center_id: 3, course_id: 2 },
  ];

  const trainer = await resolveViewer({ id: 100, role: "trainer" }, 10);
  check("a trainer is found", trainer.trainer?.t_id === 7);
  // findOne here is the bug that has bitten this codebase repeatedly: a trainer
  // teaching two centres was scoped to whichever row came back first.
  check("with ALL their allocations, not the first", trainer.allocations.length === 2);

  const student = await resolveViewer({ id: 200, role: "student" }, 10);
  check("a student is found", student.student?.std_rollno === "DB10-1");

  const admin = await resolveViewer({ id: 1, role: "superadmin" }, 10);
  check("an admin is recognised", admin.isAdmin === true);

  // Case is normalised: the database holds "MasterTrainer", "Center Manager".
  const master = await resolveViewer({ id: 2, role: "MasterTrainer" }, 10);
  check("role casing does not matter", master.isAdmin === true);

  console.log("\nWhat each role may list\n");

  check("an admin sees everything", JSON.stringify(assignmentScopeFor(admin)) === "{}");
  check(
    "a trainer sees the work they set",
    assignmentScopeFor(trainer)?.t_id === 7,
    JSON.stringify(assignmentScopeFor(trainer))
  );
  check(
    "a student sees their own class",
    assignmentScopeFor(student)?.center_id === 3 &&
      assignmentScopeFor(student)?.course_id === 2
  );

  // The heart of it. A missing record used to leave the WHERE clause unscoped,
  // so the person saw the whole batch.
  db.trainers = [];
  const ghostTrainer = await resolveViewer({ id: 999, role: "trainer" }, 10);
  check(
    "a trainer with no record sees NOTHING, not everything",
    assignmentScopeFor(ghostTrainer) === null
  );

  db.students = [];
  const ghostStudent = await resolveViewer({ id: 998, role: "student" }, 10);
  check(
    "a student with no record sees NOTHING, not everything",
    assignmentScopeFor(ghostStudent) === null
  );

  const stranger = await resolveViewer({ id: 3, role: "center manager" }, 10);
  check(
    "a role with no place here sees nothing",
    assignmentScopeFor(stranger) === null
  );

  console.log("\nEditing and deleting\n");

  db.trainers = [{ t_id: 7, user_id: 100 }];
  const owner = await resolveViewer({ id: 100, role: "trainer" }, 10);
  check("the trainer who set it may manage it", canManageAssignment(owner, assignment));
  check("an admin may manage it", canManageAssignment(admin, assignment));

  // Another trainer at the same centre. Their own work is not this.
  db.trainers = [{ t_id: 8, user_id: 101 }];
  const colleague = await resolveViewer({ id: 101, role: "trainer" }, 10);
  check(
    "a different trainer may NOT manage it",
    !canManageAssignment(colleague, assignment)
  );

  db.students = [
    { std_id: 1, user_id: 200, std_rollno: "DB10-1", tb_id: 10, center_id: 3, course_id: 2 },
  ];
  const pupil = await resolveViewer({ id: 200, role: "student" }, 10);
  check("a student may not manage it", !canManageAssignment(pupil, assignment));
  check("nor manage a missing assignment", !canManageAssignment(admin, null));

  console.log("\nMarking\n");

  // The check that did not exist: any signed-in user could PUT marks.
  check("a student may NOT mark work", !canMarkSubmission(pupil, assignment));
  check("the trainer who set it may", canMarkSubmission(owner, assignment));
  check("another trainer may not", !canMarkSubmission(colleague, assignment));

  console.log("\nReading one submission\n");

  const own = { std_rollno: "DB10-1" };
  const other = { std_rollno: "DB10-2" };

  check("a student may read their own", canReadSubmission(pupil, assignment, own));
  check(
    "but not a classmate's",
    !canReadSubmission(pupil, assignment, other),
    "this handed out other students' marks"
  );
  check("their trainer may read it", canReadSubmission(owner, assignment, own));
  check("another trainer may not", !canReadSubmission(colleague, assignment, own));

  console.log("\nIs this assignment even theirs?\n");

  const mine = { tb_id: 10, center_id: 3, course_id: 2 };
  check("their own class", belongsToStudent(assignment, mine));
  check(
    "a different centre is not",
    !belongsToStudent(assignment, { ...mine, center_id: 4 })
  );
  check(
    "a different course is not",
    !belongsToStudent(assignment, { ...mine, course_id: 9 })
  );
  check(
    "a different batch is not",
    !belongsToStudent(assignment, { ...mine, tb_id: 9 })
  );
  check("no student is not", !belongsToStudent(assignment, null));
  check("no assignment is not", !belongsToStudent(null, mine));

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((error) => {
  console.error("test run failed:", error);
  process.exit(1);
});
