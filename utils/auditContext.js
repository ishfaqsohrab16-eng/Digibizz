const { AsyncLocalStorage } = require("node:async_hooks");

/**
 * Who is making the current request, available anywhere without passing it
 * through every function signature.
 *
 * The audit hooks run deep inside Sequelize, far from the Express handler that
 * knows the user. Threading an actor down through forty controllers into every
 * `.update()` call would be invasive and easy to forget on the one path that
 * matters. AsyncLocalStorage carries it implicitly instead, and correctly
 * across `await` boundaries - a plain module-level variable would be shared
 * between concurrent requests and attribute one user's change to another.
 *
 * Work with no request behind it - the campaign dispatcher, startup migrations
 * - simply has no store, and the hooks skip it rather than inventing an actor.
 */
const storage = new AsyncLocalStorage();

/** Run `fn` with `actor` visible to everything it calls, including async work. */
const runWithActor = (actor, fn) => storage.run({ actor }, fn);

/** The current actor, or null outside a request. */
const getActor = () => storage.getStore()?.actor || null;

/**
 * Temporarily suppress auditing inside `fn`.
 *
 * For deliberate bulk work - a purge, an import - where one audit row per
 * affected record would bury the single meaningful entry describing the whole
 * operation.
 */
const runWithoutAudit = (fn) => {
  const store = storage.getStore();
  return storage.run({ ...(store || {}), suppressed: true }, fn);
};

const isSuppressed = () => Boolean(storage.getStore()?.suppressed);

module.exports = { runWithActor, getActor, runWithoutAudit, isSuppressed };
