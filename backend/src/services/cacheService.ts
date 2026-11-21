import Redis from 'ioredis';

// ====================================================
// 1. Environment-Configurable Cache Settings
// ====================================================
function parseEnvPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const CACHE_CONFIG = {
  enabled: String(process.env.CACHE_ENABLED ?? 'true').trim().toLowerCase() !== 'false',
  maxEntries: parseEnvPositiveInt('CACHE_MAX_ENTRIES', 1000),
  ttl: {
    syllabusMs: parseEnvPositiveInt('CACHE_TTL_SYLLABUS_MS', 5 * 60_000), // 5 minutes
    studyMaterialsMs: parseEnvPositiveInt('CACHE_TTL_STUDY_MATERIALS_MS', 3 * 60_000), // 3 minutes
    mcqMs: parseEnvPositiveInt('CACHE_TTL_MCQ_MS', 2 * 60_000), // 2 minutes
    defaultMs: parseEnvPositiveInt('CACHE_TTL_DEFAULT_MS', 60_000), // 1 minute
  },
} as const;

// ====================================================
// 2. Pluggable CacheProvider Interface (Memory / Redis)
// ====================================================
export interface CacheStats {
  provider: 'memory' | 'redis' | 'redis-fallback-memory';
  enabled: boolean;
  hits: number;
  misses: number;
  sets: number;
  invalidations: number;
  stampedeCoalesced: number;
  entries: number;
}

export interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  getSync<T>(key: string): T | null;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  setSync<T>(key: string, value: T, ttlMs: number): void;
  delete(key: string): Promise<void>;
  invalidatePrefix(prefix: string): Promise<number>;
  invalidatePrefixSync(prefix: string): number;
  clear(): Promise<void>;
  size(): number;
}

interface MemoryEntry<T> {
  value: T;
  expiresAt: number;
}

export class InMemoryCacheProvider implements CacheProvider {
  private store = new Map<string, MemoryEntry<unknown>>();
  private maxEntries: number;

  constructor(maxEntries: number = CACHE_CONFIG.maxEntries) {
    this.maxEntries = maxEntries;
  }

  getSync<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    // Refresh LRU order on read
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value as T;
  }

  async get<T>(key: string): Promise<T | null> {
    return this.getSync<T>(key);
  }

  setSync<T>(key: string, value: T, ttlMs: number): void {
    if (ttlMs <= 0) return;
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      // Evict oldest (LRU) entry
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) this.store.delete(oldestKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    this.setSync(key, value, ttlMs);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  invalidatePrefixSync(prefix: string): number {
    let removed = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  async invalidatePrefix(prefix: string): Promise<number> {
    return this.invalidatePrefixSync(prefix);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

/**
 * Optional Redis-backed provider with automatic fail-open fallback to InMemoryCacheProvider.
 * Activated only when REDIS_URL is configured (or explicitly injected).
 */
export class RedisCacheProvider implements CacheProvider {
  private redis: Redis;
  private fallback: InMemoryCacheProvider;
  private ready = false;
  private keyPrefix = 'tnpsc_cache:';

  constructor(redisUrlOrClient: string | Redis, fallback = new InMemoryCacheProvider()) {
    this.fallback = fallback;
    if (typeof redisUrlOrClient === 'string') {
      this.redis = new Redis(redisUrlOrClient, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        connectTimeout: 3000,
        retryStrategy: (times) => Math.min(times * 500, 30_000),
      });
    } else {
      this.redis = redisUrlOrClient;
    }

    this.ready = this.redis.status === 'ready';
    this.redis.on('ready', () => {
      this.ready = true;
    });
    this.redis.on('error', () => {
      this.ready = false;
    });
    this.redis.on('close', () => {
      this.ready = false;
    });
  }

  isRedisReady(): boolean {
    return this.ready || this.redis.status === 'ready';
  }

  getSync<T>(key: string): T | null {
    return this.fallback.getSync<T>(key);
  }

  setSync<T>(key: string, value: T, ttlMs: number): void {
    this.fallback.setSync(key, value, ttlMs);
    if (this.isRedisReady()) {
      this.redis.set(`${this.keyPrefix}${key}`, JSON.stringify(value), 'PX', ttlMs).catch(() => {});
    }
  }

  invalidatePrefixSync(prefix: string): number {
    const removed = this.fallback.invalidatePrefixSync(prefix);
    if (this.isRedisReady()) {
      void this.invalidateRedisPrefix(prefix).catch(() => {});
    }
    return removed;
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.isRedisReady()) {
      try {
        const raw = await this.redis.get(`${this.keyPrefix}${key}`);
        if (raw === null) return null;
        return JSON.parse(raw) as T;
      } catch {
        return this.fallback.get<T>(key);
      }
    }
    return this.fallback.get<T>(key);
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    this.fallback.setSync(key, value, ttlMs);
    if (this.isRedisReady()) {
      try {
        await this.redis.set(`${this.keyPrefix}${key}`, JSON.stringify(value), 'PX', ttlMs);
      } catch {
        // Fallback already populated
      }
    }
  }

  async delete(key: string): Promise<void> {
    await this.fallback.delete(key);
    if (this.isRedisReady()) {
      try {
        await this.redis.del(`${this.keyPrefix}${key}`);
      } catch {
        // ignore
      }
    }
  }

  private async invalidateRedisPrefix(prefix: string): Promise<number> {
    let cursor = '0';
    let removed = 0;
    const pattern = `${this.keyPrefix}${prefix}*`;
    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        removed += await this.redis.del(...keys);
      }
    } while (cursor !== '0');
    return removed;
  }

  async invalidatePrefix(prefix: string): Promise<number> {
    const localRemoved = this.fallback.invalidatePrefixSync(prefix);
    if (this.isRedisReady()) {
      try {
        const redisRemoved = await this.invalidateRedisPrefix(prefix);
        return Math.max(localRemoved, redisRemoved);
      } catch {
        return localRemoved;
      }
    }
    return localRemoved;
  }

  async clear(): Promise<void> {
    await this.fallback.clear();
    if (this.isRedisReady()) {
      try {
        await this.invalidateRedisPrefix('');
      } catch {
        // ignore
      }
    }
  }

  size(): number {
    return this.fallback.size();
  }
}

// ====================================================
// 3. Unified CacheService with Single-Flight Stampede Protection
// ====================================================
export class CacheService {
  private provider: CacheProvider;
  private enabled: boolean;
  private inFlight = new Map<string, Promise<unknown>>();
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    invalidations: 0,
    stampedeCoalesced: 0,
  };

  constructor(provider?: CacheProvider, enabled: boolean = CACHE_CONFIG.enabled) {
    this.enabled = enabled;
    if (provider) {
      this.provider = provider;
    } else {
      const redisUrl = (process.env.REDIS_URL || '').trim();
      const useRedis = Boolean(redisUrl) && String(process.env.CACHE_PROVIDER || 'auto').toLowerCase() !== 'memory';
      this.provider = useRedis ? new RedisCacheProvider(redisUrl) : new InMemoryCacheProvider();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  getSync<T>(key: string): T | null {
    if (!this.enabled) return null;
    const hit = this.provider.getSync<T>(key);
    if (hit !== null) this.stats.hits += 1;
    else this.stats.misses += 1;
    return hit;
  }

  setSync<T>(key: string, value: T, ttlMs: number = CACHE_CONFIG.ttl.defaultMs): void {
    if (!this.enabled) return;
    this.provider.setSync(key, value, ttlMs);
    this.stats.sets += 1;
  }

  invalidatePrefixSync(prefix: string): number {
    const removed = this.provider.invalidatePrefixSync(prefix);
    this.stats.invalidations += removed > 0 ? removed : 1;
    return removed;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled) return null;
    const hit = await this.provider.get<T>(key);
    if (hit !== null) this.stats.hits += 1;
    else this.stats.misses += 1;
    return hit;
  }

  async set<T>(key: string, value: T, ttlMs: number = CACHE_CONFIG.ttl.defaultMs): Promise<void> {
    if (!this.enabled) return;
    await this.provider.set(key, value, ttlMs);
    this.stats.sets += 1;
  }

  /**
   * Stampede-safe cache-aside loader:
   * Concurrent misses on the same key coalesce onto a single in-flight promise.
   */
  async getOrSet<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<{ value: T; hit: boolean }> {
    if (!this.enabled) {
      const value = await loader();
      return { value, hit: false };
    }

    const cached = await this.provider.get<T>(key);
    if (cached !== null) {
      this.stats.hits += 1;
      return { value: cached, hit: true };
    }

    const existingFlight = this.inFlight.get(key) as Promise<T> | undefined;
    if (existingFlight) {
      this.stats.stampedeCoalesced += 1;
      const value = await existingFlight;
      return { value, hit: true };
    }

    this.stats.misses += 1;
    const promise = (async () => {
      try {
        const fresh = await loader();
        await this.provider.set(key, fresh, ttlMs);
        this.stats.sets += 1;
        return fresh;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, promise);
    const value = await promise;
    return { value, hit: false };
  }

  async invalidatePrefix(prefix: string): Promise<number> {
    const removed = await this.provider.invalidatePrefix(prefix);
    this.stats.invalidations += removed > 0 ? removed : 1;
    return removed;
  }

  async clear(): Promise<void> {
    this.inFlight.clear();
    await this.provider.clear();
  }

  getStats(): CacheStats {
    let providerMode: CacheStats['provider'] = 'memory';
    if (this.provider instanceof RedisCacheProvider) {
      providerMode = this.provider.isRedisReady() ? 'redis' : 'redis-fallback-memory';
    }
    return {
      provider: providerMode,
      enabled: this.enabled,
      ...this.stats,
      entries: this.provider.size(),
    };
  }
}

export const cacheService = new CacheService();
