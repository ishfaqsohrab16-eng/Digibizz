/**
 * Tests for who may read and write a weekly M&E report.
 *
 * Run with:  node utils/evaluationAccess.test.js
 * Exits non-zero if any rule regresses.
 *
 * A report is a performance assessment of a named person, signed by two
 * others. Every case here is either "someone saw something they should not" or
 * "someone was locked out of their own work", and both are worth a test.
 */
const {
  canUseModule,
  canWrite,
  readScope,
  ownsTrainer,
  canEdit,
} = require("./evaluationAccess");

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

const as = (role) => ({ role, type: role });

console.log("\nWho can open the module\n");

check("a master trainer can", canUseModule(as("mastertrainer")));
check("a super admin can", canUseModule(as("superadmin")));
check("a content admin can", canUseModule(as("contentadmin")));
check("a read-only admin can", canUseModule(as("readonlyadmin")));

// The trainer being evaluated is the one person who most obviously must not
// read it here. How an assessment reaches someone is a conversation.
check("the trainer being evaluated cannot", !canUseModule(as("trainer")));
check("a student cannot", !canUseModule(as("student")));
check("a centre manager cannot", !canUseModule(as("center manager")));
check("a coordinator cannot", !canUseModule(as("coordinator")));
check("nobody cannot", !canUseModule(null));
check("an empty role cannot", !canUseModule({ role: "" }));

// The database stores mixed casing, which is why roles are compared through
// helpers everywhere in this app rather than as raw strings.
check("casing does not matter", canUseModule({ type: "MasterTrainer" }));
check("nor does whitespace", canUseModule({ type: "  SuperAdmin  " }));

console.log("\nWho can write\n");

check("a master trainer writes", canWrite(as("mastertrainer")));

// The report carries the MT's signature. An admin filling one in for a
// trainer they never observed is worse than a missing report, because the
// missing one is visible and the invented one is not.
check("a super admin does not", !canWrite(as("superadmin")));
check("a content admin does not", !canWrite(as("contentadmin")));
check("a trainer does not", !canWrite(as("trainer")));

console.log("\nWhat each person may read\n");

// {} means "everything" and null means "nothing". Returning {} for someone
// with no access is how a scoped query silently becomes unscoped, so the two
// are checked apart rather than for truthiness.
const adminScope = readScope(as("superadmin"), null);
check("an admin reads everything", adminScope !== null && Object.keys(adminScope).length === 0);

const mine = readScope(as("mastertrainer"), 7);
check("a master trainer reads their own", mine?.mt_id === 7, JSON.stringify(mine));

check("nothing means nothing, not everything", readScope(as("trainer"), 7) === null);
check("a student reads nothing", readScope(as("student"), null) === null);

// A master trainer with no mt_id resolved is not an admin. Falling through to
// {} here would hand them every report in the programme.
check(
  "an unresolved master trainer reads nothing rather than everything",
  readScope(as("mastertrainer"), null) === null
);

console.log("\nWhich trainers are whose\n");

check("their own trainer", ownsTrainer(7, { mt_id: 7 }));
check("not someone else's", !ownsTrainer(7, { mt_id: 8 }));
check("a trainer with no master trainer belongs to nobody", !ownsTrainer(7, { mt_id: null }));
check("a missing trainer is not owned", !ownsTrainer(7, null));
check("a missing master trainer owns nobody", !ownsTrainer(null, { mt_id: 7 }));

// A t_id arrives in a request body, so the ids being compared come from the
// database and from a token - and one of them may be a string.
check("ids compare across types", ownsTrainer("7", { mt_id: 7 }));

console.log("\nWhat may still be changed\n");

const draft = { mt_id: 7, we_status: "draft" };
const submitted = { mt_id: 7, we_status: "submitted" };

check("a draft is the author's to change", canEdit(as("mastertrainer"), draft, 7));

// Once submitted it has been signed off and an admin may already have read it.
check("a submitted report is not", !canEdit(as("mastertrainer"), submitted, 7));

check("another master trainer's draft is not", !canEdit(as("mastertrainer"), draft, 8));
check("an admin cannot edit a draft", !canEdit(as("superadmin"), draft, 7));
check("nothing cannot be edited", !canEdit(as("mastertrainer"), null, 7));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
