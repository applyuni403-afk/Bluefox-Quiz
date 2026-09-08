// In-memory short-term cache for room state to prevent redundant queries
// across multiple polling clients (Quizmaster, screens, contestants).

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

declare global {
  var _bluefoxRoomCache: Map<string, CacheEntry<unknown>> | undefined;
}

function getCacheMap(): Map<string, CacheEntry<unknown>> {
  if (!global._bluefoxRoomCache) {
    global._bluefoxRoomCache = new Map();
  }
  return global._bluefoxRoomCache;
}

/**
 * Retrieve cached data for a given key if it hasn't expired.
 */
export function getCachedRoomState<T>(key: string): T | null {
  if (!key) return null;
  const cache = getCacheMap();
  const entry = cache.get(key.toLowerCase()) as CacheEntry<T> | undefined;
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    cache.delete(key.toLowerCase());
    return null;
  }

  return entry.data;
}

/**
 * Store data in the cache with a specified TTL in milliseconds (default 500ms).
 */
export function setCachedRoomState<T>(key: string, data: T, ttlMs = 500): void {
  if (!key) return;
  const cache = getCacheMap();
  const expiresAt = Date.now() + ttlMs;
  cache.set(key.toLowerCase(), { data, expiresAt });
}

/**
 * Invalidate cached state for one or more keys (e.g. roomId, code).
 */
export function invalidateRoomState(...keys: (string | null | undefined)[]): void {
  const cache = getCacheMap();
  for (const key of keys) {
    if (key) {
      cache.delete(key.toLowerCase());
    }
  }
}
