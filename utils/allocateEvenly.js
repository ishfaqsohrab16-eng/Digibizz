/**
 * Split a quota across buckets as evenly as the available supply allows.
 *
 * Used by the email campaign module: a campaign asks for N emails at one
 * center and N is divided across that center's courses.
 *
 * The subtle part is supply. A plain `N / courses` share silently wastes the
 * quota whenever one course has fewer candidates than its share - asking for
 * 200 across three courses where one only has 10 people would send 143, not
 * 200. Whatever a short course cannot absorb is redistributed over the courses
 * that still have people left, repeating until either the quota is met or
 * everyone available has been allocated.
 *
 * Pure arithmetic and no I/O, so it is unit-tested directly by
 * utils/emailCampaignAllocation.test.js.
 *
 * @param {number} total   How many to hand out in all.
 * @param {Array<{key: any, available: number}>} buckets
 * @returns {Map<any, number>} allocation per bucket key; never exceeds `available`.
 */
const allocateEvenly = (total, buckets) => {
  const allocation = new Map(buckets.map((bucket) => [bucket.key, 0]));
  let remaining = Math.max(0, Math.floor(Number(total) || 0));

  // Buckets that can still take more.
  let open = buckets.filter((bucket) => bucket.available > 0);

  while (remaining > 0 && open.length > 0) {
    const share = Math.floor(remaining / open.length);

    if (share === 0) {
      // Fewer left to give than there are buckets: hand out one each, largest
      // remaining supply first, so the leftovers do not all land on whichever
      // course happened to sort first.
      const ordered = [...open].sort(
        (a, b) =>
          b.available -
          allocation.get(b.key) -
          (a.available - allocation.get(a.key))
      );
      for (const bucket of ordered) {
        if (remaining === 0) break;
        if (allocation.get(bucket.key) >= bucket.available) continue;
        allocation.set(bucket.key, allocation.get(bucket.key) + 1);
        remaining -= 1;
      }
      break;
    }

    for (const bucket of open) {
      const headroom = bucket.available - allocation.get(bucket.key);
      const take = Math.min(share, headroom);
      allocation.set(bucket.key, allocation.get(bucket.key) + take);
      remaining -= take;
    }

    open = open.filter(
      (bucket) => bucket.available - allocation.get(bucket.key) > 0
    );
  }

  return allocation;
};

module.exports = { allocateEvenly };
