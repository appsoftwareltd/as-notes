/**
 * A small LRU cache with O(1) get/set/evict using Map insertion order.
 *
 * - On `get`, the entry is promoted to most-recently-used.
 * - When exceeding `maxSize`, the least-recently-used entry is evicted.
 */
export class LRUCache<K, V> {
  private cache = new Map<K, V>();

  constructor(private readonly maxSize: number) {
    if (!Number.isFinite(maxSize) || maxSize <= 0) {
      throw new Error(`LRUCache maxSize must be > 0 (got ${maxSize})`);
    }
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value === undefined) {
      return undefined;
    }
    // Promote to MRU by reinserting.
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, value);
    this.evictIfNeeded();
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  private evictIfNeeded(): void {
    while (this.cache.size > this.maxSize) {
      const lruKey = this.cache.keys().next().value as K | undefined;
      if (lruKey === undefined) {
        return;
      }
      this.cache.delete(lruKey);
    }
  }
}
