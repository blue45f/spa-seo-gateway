import { createKeyv } from '@cacheable/memory';
import { coalesceAsync } from '@cacheable/utils';
import KeyvRedis from '@keyv/redis';
import { Cacheable } from 'cacheable';
import { Keyv } from 'keyv';
import { config } from './config.js';
import { logger } from './logger.js';
import { cacheEvents } from './metrics.js';

export type CacheEntry = {
  body: string;
  status: number;
  headers: Record<string, string>;
  createdAt: number;
};

export type SwrResult = {
  entry: CacheEntry;
  fromCache: 'cache' | null;
  stale: boolean;
};

const ttlMs = config.cache.memory.ttlMs;
const swrMs = config.cache.swrWindowMs;
const totalLifeMs = ttlMs + swrMs;

const primary = config.cache.memory.enabled
  ? createKeyv({ ttl: totalLifeMs, lruSize: config.cache.memory.maxItems })
  : undefined;

let secondary: Keyv | undefined;
if (config.cache.redis.enabled && config.cache.redis.url) {
  const store = new KeyvRedis(config.cache.redis.url);
  store.on('error', (e: Error) => logger.warn({ err: e.message }, 'redis cache degrade'));
  secondary = new Keyv({ store, namespace: config.cache.redis.keyPrefix.replace(/:$/, '') });
}

const cache = new Cacheable({
  primary,
  secondary,
  ttl: totalLifeMs,
  nonBlocking: true,
});
cache.on('error', (e: Error) => logger.warn({ err: e.message }, 'cache error'));

async function fetchAndStore(
  key: string,
  fetcher: () => Promise<CacheEntry>,
  totalLifeMsOverride?: number,
): Promise<CacheEntry> {
  const result = await coalesceAsync(`render:${key}`, async () => {
    const entry = await fetcher();
    await cache.set(key, entry, totalLifeMsOverride);
    return entry;
  });
  if (!result) throw new Error('coalesce returned no value');
  return result;
}

export async function cacheGet(key: string): Promise<CacheEntry | undefined> {
  return (await cache.get<CacheEntry>(key)) ?? undefined;
}

export async function cacheSet(key: string, entry: CacheEntry): Promise<void> {
  await cache.set(key, entry);
}

export async function cacheDel(key: string): Promise<void> {
  await cache.delete(key);
}

export async function cacheClear(): Promise<number> {
  await cache.clear();
  return 0;
}

export function cacheStats() {
  return { ttlMs, swrMs, redisEnabled: !!secondary };
}

export async function shutdownCache(): Promise<void> {
  await cache.disconnect();
}

export async function cacheSwr(
  key: string,
  fetcher: () => Promise<CacheEntry>,
  customTtlMs?: number,
): Promise<SwrResult> {
  const ttl = customTtlMs ?? ttlMs;
  const totalLife = ttl + swrMs;
  const cached = await cache.get<CacheEntry>(key);
  if (cached) {
    const age = Date.now() - cached.createdAt;
    if (age < ttl) {
      cacheEvents.inc({ layer: 'cache', event: 'hit' });
      return { entry: cached, fromCache: 'cache', stale: false };
    }
    if (age < totalLife) {
      cacheEvents.inc({ layer: 'cache', event: 'swr' });
      void fetchAndStore(key, fetcher, totalLife).catch((err) =>
        logger.warn({ err: (err as Error).message, key }, 'swr revalidation failed'),
      );
      return { entry: cached, fromCache: 'cache', stale: true };
    }
  }
  cacheEvents.inc({ layer: 'cache', event: 'miss' });
  const entry = await fetchAndStore(key, fetcher, totalLife);
  return { entry, fromCache: null, stale: false };
}
