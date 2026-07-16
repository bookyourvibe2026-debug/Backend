/**
 * Tiny in-memory TTL cache for read-heavy endpoints.
 *
 * Keeps hot responses (public venue browse / detail / vendor profile) in
 * process memory so repeated requests skip the database round-trip and
 * respond in microseconds instead of tens/hundreds of milliseconds.
 *
 * Values are stored as-is (including Mongoose documents) so the serialized
 * response is byte-for-byte identical to the uncached path. Freshness is kept
 * with a short TTL plus explicit prefix invalidation on every write.
 */

interface Entry<T> {
  value: T;
  expires: number;
}

/** Hard cap on entries so an attacker spraying unique query strings can't grow memory unbounded. */
const MAX_ENTRIES = 1000;

const store = new Map<string, Entry<unknown>>();

/** Remove entries that have passed their expiry. Called opportunistically. */
function sweepExpired(now: number): void {
  for (const [key, entry] of store) {
    if (entry.expires <= now) store.delete(key);
  }
}

/**
 * Return the cached value for `key`, or compute it with `compute`, store it for
 * `ttlMs`, and return it. Concurrent callers may each compute once on a cold key
 * (acceptable for our read endpoints); after that they share the cached value.
 */
export async function cached<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value as T;

  const value = await compute();

  if (store.size >= MAX_ENTRIES) {
    sweepExpired(now);
    // Still full after sweeping? Drop the oldest insertion to make room.
    if (store.size >= MAX_ENTRIES) {
      const oldest = store.keys().next().value;
      if (oldest !== undefined) store.delete(oldest);
    }
  }

  store.set(key, { value, expires: now + ttlMs });
  return value;
}

/** Drop every cache entry whose key starts with `prefix`. Use on writes to keep reads fresh. */
export function invalidatePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/** Clear the entire cache. */
export function clearCache(): void {
  store.clear();
}
