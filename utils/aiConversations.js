/**
 * What the assistant has already fetched, kept for the rest of the conversation.
 *
 * Without this, every turn started from nothing. Asking "show all that data in
 * a table" after a chart answered with a sentence and no table: the model was
 * sent the previous QUESTION and its own SUMMARY, but not the rows, so it had
 * nothing to put in a table and no way to know it was missing anything.
 *
 * Re-running the query would have been the obvious fix and the wrong one. On a
 * CPU-only machine a round trip is the better part of a minute, and "show me
 * that again differently" should be instant - the data is already here.
 *
 * Held in memory rather than in the database. These are a few hundred rows
 * belonging to one person's train of thought, they are worthless twenty minutes
 * later, and a table of them would need cleaning up forever.
 */

/** How long a conversation's data stays available. */
const TTL_MS = Number(process.env.AI_CONVERSATION_TTL_MS) || 60 * 60 * 1000;

/** Datasets remembered per conversation. Oldest are dropped first. */
const MAX_DATASETS = Number(process.env.AI_MAX_DATASETS) || 8;

/**
 * Conversations held at once.
 *
 * This is a Super Admin feature, so the realistic number is one or two. The cap
 * exists so a long-running process cannot accumulate them without bound.
 */
const MAX_CONVERSATIONS = 40;

const store = new Map();

const now = () => Date.now();

/** Drop anything past its time, and the oldest if there are too many. */
const evict = () => {
  const cutoff = now() - TTL_MS;
  for (const [id, entry] of store) {
    if (entry.at < cutoff) store.delete(id);
  }

  while (store.size > MAX_CONVERSATIONS) {
    // Map preserves insertion order, and `remember` re-inserts on every write,
    // so the first key is the least recently used.
    const oldest = store.keys().next().value;
    store.delete(oldest);
  }
};

/** Everything this conversation has fetched, oldest first. */
const datasetsFor = (conversationId) => {
  if (!conversationId) return [];
  evict();

  const entry = store.get(conversationId);
  if (!entry) return [];

  entry.at = now();
  return entry.datasets;
};

/**
 * Record what a turn fetched.
 *
 * Re-inserted rather than mutated in place so the Map's ordering stays a
 * least-recently-used list for the eviction above.
 */
const remember = (conversationId, datasets) => {
  if (!conversationId || !Array.isArray(datasets) || datasets.length === 0) return;

  const existing = store.get(conversationId);
  const combined = [...(existing?.datasets || []), ...datasets];

  store.delete(conversationId);
  store.set(conversationId, {
    at: now(),
    // The most recent ones. An early exploratory query is rarely what a
    // follow-up is about, and keeping everything would grow without limit.
    datasets: combined.slice(-MAX_DATASETS),
  });

  evict();
};

const forget = (conversationId) => {
  store.delete(conversationId);
};

module.exports = {
  datasetsFor,
  remember,
  forget,
  TTL_MS,
  MAX_DATASETS,
  _store: store,
};
