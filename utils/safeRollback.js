/**
 * Roll a transaction back without being able to make things worse.
 *
 * A catch block that calls `t.rollback()` unconditionally is a loaded gun.
 * Sequelize throws when a transaction has already been committed or rolled
 * back - "Transaction cannot be rolled back because it has been finished with
 * state: rollback" - and a throw from INSIDE a catch, in an async request
 * handler Express never awaits, is an unhandled rejection. Node ends the
 * process for those. So the second failure kills the server, and it does it
 * while handling the first one, which is the moment the logs are least useful.
 *
 * That is not hypothetical: submitQuizAnswers rolled back, answered the
 * request, and then something in the response threw. The catch rolled back a
 * second time and took the whole container down with it, repeatedly.
 *
 * Two rules, and they are the whole module:
 *
 *   NEVER ROLL BACK A FINISHED TRANSACTION. `finished` is 'commit' or
 *   'rollback' once either has happened, and there is nothing left to undo.
 *
 *   NEVER THROW. The caller is already handling a failure; whatever went
 *   wrong here matters less than the error being handled, and losing that
 *   error is the one outcome worth ruling out.
 */

const safeRollback = async (transaction) => {
  if (!transaction || transaction.finished) return false;

  try {
    await transaction.rollback();
    return true;
  } catch (error) {
    // Logged, not raised. A rollback that fails has usually failed because
    // the connection went away, in which case the database has already
    // discarded the work for us.
    console.error("[db] rollback failed:", error.message);
    return false;
  }
};

module.exports = { safeRollback };
