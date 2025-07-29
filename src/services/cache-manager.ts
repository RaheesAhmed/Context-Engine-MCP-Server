import { CacheEntry } from '../types/index.js';
import { configManager } from '../config/index.js';
import logger, { logMemoryUsage } from '../utils/logger.js';
import { ContextEngineError, ErrorCodes } from '../utils/errors.js';

export class CacheManager<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder = new Map<string, number>(); // LRU tracking
  private cleanupInterval: NodeJS.Timeout | null = null;
  private accessCounter = 0;

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Set a value in the cache with optional expiration
   */
  set(key: string, value: T, ttlMs?: number): void {
    try {
      const now = Date.now();
      const entry: CacheEntry<T> = {
        data: value,
        timestamp: now
      };

      // Add expiration if TTL provided
      if (ttlMs && ttlMs > 0) {
        (entry as any).expiresAt = now + ttlMs;
      }

      // Remove oldest entries if cache is full
      this.enforceMaxSize();

      this.cache.set(key, entry);
      this.accessOrder.set(key, ++this.accessCounter);

      logger.debug(`Cache set: ${key}`, { size: this.cache.size });
    } catch (error) {
      throw new ContextEngineError(
        ErrorCodes.CACHE_ERROR,
        `Failed to set cache entry: ${key}`,
        { key, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Get a value from the cache
   */
  get(key: string): T | undefined {
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        logger.debug(`Cache miss: ${key}`);
        return undefined;
      }

      // Check if entry has expired
      if ((entry as any).expiresAt && Date.now() > (entry as any).expiresAt) {
        this.delete(key);
        logger.debug(`Cache expired: ${key}`);
        return undefined;
      }

      // Update access order for LRU
      this.accessOrder.set(key, ++this.accessCounter);
      
      logger.debug(`Cache hit: ${key}`);
      return entry.data;
    } catch (error) {
      logger.error(`Error getting cache entry: ${key}`, { error });
      return undefined;
    }
  }

  /**
   * Check if a key exists in cache and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check expiration
    if ((entry as any).expiresAt && Date.now() > (entry as any).expiresAt) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a cache entry
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    this.accessOrder.delete(key);
    
    if (deleted) {
      logger.debug(`Cache deleted: ${key}`, { size: this.cache.size });
    }
    
    return deleted;
  }

  /**
   * Get cache entry with metadata
   */
  getWithMetadata(key: string): (CacheEntry<T> & { key: string }) | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check expiration
    if ((entry as any).expiresAt && Date.now() > (entry as any).expiresAt) {
      this.delete(key);
      return undefined;
    }

    return { ...entry, key };
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
    
    logger.info(`Cache cleared`, { previousSize: size });
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    oldestEntry?: string;
    newestEntry?: string;
    memoryUsage: string;
  } {
    const entries = Array.from(this.cache.entries());
    let oldestEntry: string | undefined;
    let newestEntry: string | undefined;
    let oldestTime = Infinity;
    let newestTime = 0;

    for (const [key, entry] of entries) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestEntry = key;
      }
      if (entry.timestamp > newestTime) {
        newestTime = entry.timestamp;
        newestEntry = key;
      }
    }

    // Rough memory usage estimation
    const memoryUsage = this.estimateMemoryUsage();

    const result: {
      size: number;
      maxSize: number;
      oldestEntry?: string;
      newestEntry?: string;
      memoryUsage: string;
    } = {
      size: this.cache.size,
      maxSize: configManager.get('maxCacheSize'),
      memoryUsage: `${Math.round(memoryUsage / 1024)}KB`
    };

    if (oldestEntry !== undefined) {
      result.oldestEntry = oldestEntry;
    }
    
    if (newestEntry !== undefined) {
      result.newestEntry = newestEntry;
    }

    return result;
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if ((entry as any).expiresAt && now > (entry as any).expiresAt) {
        this.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.info(`Cache cleanup completed`, { removedEntries: removed, remainingSize: this.cache.size });
      logMemoryUsage('cache cleanup');
    }

    return removed;
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    const interval = configManager.get('cacheCleanupInterval');
    
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, interval);

    logger.debug(`Cache cleanup timer started`, { intervalMs: interval });
  }

  /**
   * Stop automatic cleanup timer
   */
  stopCleanupTimer(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.debug('Cache cleanup timer stopped');
    }
  }

  /**
   * Enforce maximum cache size using LRU eviction
   */
  private enforceMaxSize(): void {
    const maxSize = configManager.get('maxCacheSize');
    
    if (this.cache.size >= maxSize) {
      // Sort by access order and remove least recently used
      const sortedByAccess = Array.from(this.accessOrder.entries())
        .sort(([,a], [,b]) => a - b);

      const toRemove = Math.floor(maxSize * 0.1) || 1; // Remove 10% or at least 1
      
      for (let i = 0; i < toRemove && i < sortedByAccess.length; i++) {
        const [key] = sortedByAccess[i]!;
        this.delete(key);
      }

      logger.info(`Cache size enforced`, { 
        removedEntries: toRemove, 
        currentSize: this.cache.size,
        maxSize 
      });
    }
  }

  /**
   * Estimate memory usage (rough calculation)
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;

    for (const [key, entry] of this.cache.entries()) {
      // Rough estimation: key size + JSON string size of data
      totalSize += key.length * 2; // UTF-16 characters
      
      try {
        const dataStr = JSON.stringify(entry.data);
        totalSize += dataStr.length * 2;
      } catch {
        // If data can't be serialized, use a rough estimate
        totalSize += 1000; // 1KB estimate
      }
      
      totalSize += 64; // Rough overhead for entry metadata
    }

    return totalSize;
  }

  /**
   * Destroy the cache manager
   */
  destroy(): void {
    this.stopCleanupTimer();
    this.clear();
    logger.info('Cache manager destroyed');
  }
}

// Global cache instances for different data types
export const fileCache = new CacheManager<any>();
export const projectCache = new CacheManager<any>();
export const analysisCache = new CacheManager<any>();

// Cleanup on process exit
process.on('exit', () => {
  fileCache.destroy();
  projectCache.destroy();
  analysisCache.destroy();
});

process.on('SIGINT', () => {
  fileCache.destroy();
  projectCache.destroy();
  analysisCache.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  fileCache.destroy();
  projectCache.destroy();
  analysisCache.destroy();
  process.exit(0);
});
