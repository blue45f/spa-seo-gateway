import { LRUCache } from 'lru-cache';
import { Redis, type Redis as RedisClient } from 'ioredis';
import { config } from './config.js';
import { logger } from './logger.js';
import { cacheEvents } from './metrics.js';

export type CacheEntry = {
  body: string;
  status: number;
  headers: Record<string, string>;
  createdAt: number;
};

export type SwrLayer = 'memory' | 'redis' | null;

export type SwrResult = {
  entry: CacheEntry;
  fromCache: SwrLayer;
  stale: boolean;
};

const lru = config.cache.memory.enabled
  ? new LRUCache<string, CacheEntry>({
      max: config.cache.memory.maxItems,
      maxSize: config.cache.memory.maxBytes,
      sizeCalculation: (e) =>
        Buffer.byteLength(e.body, 'utf8') +
        Buffer.byteLength(JSON.stringify(e.headers), 'utf8') +
        64,
      ttl: config.cache.memory.ttlMs + config.cache.swrWindowMs,
      allowStale: true,
    })
  : null;

let redis: RedisClient | null = null;
if (config.cache.redis.enabled && config.cache.redis.url) {
  const client = new Redis(config.cache.redis.url, {
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    lazyConnect: false,
    connectTimeout: 5_000,
  });
  client.on('error', (e) =>
    logger.warn({ err: e.message }, 'redis error (degrading to memory only)'),
  );
  client.on('ready', () => logger.info('redis cache ready'));
  redis = client;
}

const rk = (k: string) => `${config.cache.redis.keyPrefix}${k}`;

async function getRedis(key: string): Promise<CacheEntry | null> {
  if (!redis) return null;
  try {
    const raw = await redis.get(rk(key));
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry;
  } catch (e) {
    logger.warn({ err: (e as Error).message }, 'redis get failed');
    return null;
  }
}

async function setRedis(key: string, entry: CacheEntry): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(
      rk(key),
      JSON.stringify(entry),
      'EX',
      config.cache.redis.ttlSec,
    );
  } catch (e) {
    logger.warn({ err: (e as Error).message }, 'redis set failed');
  }
}

async function delRedis(key: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(rk(key));
  } catch (e) {
    logger.warn({ err: (e as Error).message }, 'redis del failed');
  }
}

export async function cacheGet(
  key: string,
): Promise<{ entry: CacheEntry; layer: SwrLayer } | null> {
  if (!config.cache.enabled) return null;
  if (lru) {
    const m = lru.get(key, { allowStale: true });
    if (m) {
      cacheEvents.inc({ layer: 'memory', event: 'hit' });
      return { entry: m, layer: 'memory' };
    }
    cacheEvents.inc({ layer: 'memory', event: 'miss' });
  }
  const r = await getRedis(key);
  if (r) {
    cacheEvents.inc({ layer: 'redis', event: 'hit' });
    if (lru) lru.set(key, r);
    return { entry: r, layer: 'redis' };
  }
  if (redis) cacheEvents.inc({ layer: 'redis', event: 'miss' });
  return null;
}

export async function cacheSet(key: string, entry: CacheEntry): Promise<void> {
  if (!config.cache.enabled) return;
  if (lru) lru.set(key, entry);
  await setRedis(key, entry);
}

export async function cacheDel(key: string): Promise<void> {
  if (lru) lru.delete(key);
  await delRedis(key);
}

export async function cacheClear(): Promise<number> {
  let cleared = 0;
  if (lru) {
    cleared += lru.size;
    lru.clear();
  }
  if (redis) {
    try {
      const stream = redis.scanStream({
        match: `${config.cache.redis.keyPrefix}*`,
        count: 100,
      });
      const pipeline = redis.pipeline();
      for await (const keys of stream) {
        for (const k of keys as string[]) pipeline.del(k);
        cleared += (keys as string[]).length;
      }
      await pipeline.exec();
    } catch (e) {
      logger.warn({ err: (e as Error).message }, 'redis clear failed');
    }
  }
  return cleared;
}

const inflight = new Map<string, Promise<CacheEntry>>();

async function dedup(
  key: string,
  fetcher: () => Promise<CacheEntry>,
): Promise<CacheEntry> {
  const existing = inflight.get(key);
  if (existing) {
    cacheEvents.inc({ layer: 'inflight', event: 'dedup' });
    return existing;
  }
  const p = (async () => {
    try {
      const entry = await fetcher();
      cacheSet(key, entry).catch((err) =>
        logger.warn({ err: err.message }, 'cache set failed'),
      );
      return entry;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

function revalidateInBackground(
  key: string,
  fetcher: () => Promise<CacheEntry>,
): void {
  if (inflight.has(key)) return;
  dedup(key, fetcher).catch((err) =>
    logger.warn({ err: err.message, key }, 'swr revalidation failed'),
  );
}

export async function cacheSwr(
  key: string,
  fetcher: () => Promise<CacheEntry>,
): Promise<SwrResult> {
  const ttlMs = config.cache.memory.ttlMs;
  const swrWindow = config.cache.swrWindowMs;

  const cached = await cacheGet(key);
  const now = Date.now();

  if (cached) {
    const age = now - cached.entry.createdAt;
    if (age < ttlMs) {
      return { entry: cached.entry, fromCache: cached.layer, stale: false };
    }
    if (age < ttlMs + swrWindow) {
      cacheEvents.inc({ layer: cached.layer ?? 'unknown', event: 'swr' });
      revalidateInBackground(key, fetcher);
      return { entry: cached.entry, fromCache: cached.layer, stale: true };
    }
  }
  const entry = await dedup(key, fetcher);
  return { entry, fromCache: null, stale: false };
}

export async function shutdownCache(): Promise<void> {
  if (redis) {
    try {
      await redis.quit();
    } catch {
      redis.disconnect();
    }
  }
}

export function cacheStats() {
  return {
    memory: lru
      ? {
          size: lru.size,
          calculatedSize: lru.calculatedSize,
          maxSize: config.cache.memory.maxBytes,
        }
      : null,
    redis: redis ? { status: redis.status } : null,
    inflight: inflight.size,
  };
}
