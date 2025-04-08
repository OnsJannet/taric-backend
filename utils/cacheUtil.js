/**
 * A simple in-memory cache implementation
 */
class MemoryCache {
  constructor(ttl = 3600000) { // Default TTL: 1 hour
    this.cache = new Map();
    this.ttl = ttl;
  }

  /**
   * Get a value from the cache
   * @param {string} key - The cache key
   * @returns {*} The cached value or undefined if not found
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) return undefined;

    const now = Date.now();
    if (now > item.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    return item.value;
  }

  /**
   * Set a value in the cache
   * @param {string} key - The cache key
   * @param {*} value - The value to cache
   * @param {number} [ttl] - Optional TTL in milliseconds
   * @returns {MemoryCache} The cache instance for chaining
   */
  set(key, value, ttl = this.ttl) {
    const expiry = Date.now() + ttl;
    this.cache.set(key, { value, expiry });
    return this;
  }

  /**
   * Check if a key exists in the cache
   * @param {string} key - The cache key
   * @returns {boolean} True if the key exists and is not expired
   */
  has(key) {
    return this.get(key) !== undefined;
  }

  /**
   * Delete a key from the cache
   * @param {string} key - The cache key
   * @returns {boolean} True if the key was deleted, false if it didn't exist
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Clear all items from the cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get all valid keys in the cache
   * @returns {string[]} Array of all non-expired keys
   */
  keys() {
    const now = Date.now();
    const validKeys = [];

    for (const [key, item] of this.cache.entries()) {
      if (now <= item.expiry) {
        validKeys.push(key);
      } else {
        this.cache.delete(key); // Clean up expired items
      }
    }

    return validKeys;
  }

  /**
   * Get the number of valid items in the cache
   * @returns {number} Count of non-expired items
   */
  size() {
    return this.keys().length;
  }
}

module.exports = MemoryCache;
