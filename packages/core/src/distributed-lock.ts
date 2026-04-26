/**
 * 분산 dedup — 멀티 노드 운영 시 동일 URL 동시 렌더 1번으로.
 *
 * 단일 노드는 이미 in-process coalesceAsync 로 dedup 됨. 멀티 노드 환경에서는
 * Redis SETNX 락으로 한 번에 한 노드만 렌더, 나머지는 짧은 대기 후 캐시 확인.
 *
 * Redis 가 없거나 비활성이면 그냥 fetcher 를 즉시 실행 (단일 노드처럼 동작).
 */
import KeyvRedis from '@keyv/redis';
import { config } from './config.js';
import { logger } from './logger.js';

type RedisLikeClient = {
  set(key: string, value: string, opts?: { NX?: boolean; EX?: number }): Promise<unknown>;
  get(key: string): Promise<string | null | unknown>;
  del(key: string | string[]): Promise<unknown>;
};

let redisClient: RedisLikeClient | null = null;
let connecting: Promise<RedisLikeClient | null> | null = null;

async function getClient(): Promise<RedisLikeClient | null> {
  if (!config.cache.redis.enabled || !config.cache.redis.url) return null;
  if (redisClient) return redisClient;
  if (connecting) return connecting;
  connecting = (async () => {
    try {
      const k = new KeyvRedis(config.cache.redis.url!);
      const c = (await k.getClient()) as unknown as RedisLikeClient;
      redisClient = c;
      return c;
    } catch (e) {
      logger.warn({ err: (e as Error).message }, 'distributed lock redis init 실패');
      return null;
    } finally {
      connecting = null;
    }
  })();
  return connecting;
}

const LOCK_TTL_SEC = 60;
const POLL_INTERVAL_MS = 150;
const MAX_WAIT_MS = 30_000;

export async function withDistributedLock<T>(
  key: string,
  fn: () => Promise<T>,
  options: { fallback?: () => Promise<T | undefined> } = {},
): Promise<T> {
  const redis = await getClient();
  if (!redis) return fn();

  const lockKey = `${config.cache.redis.keyPrefix}lock:${key}`;
  try {
    const got = await redis.set(lockKey, process.pid.toString(), {
      NX: true,
      EX: LOCK_TTL_SEC,
    });
    if (got === 'OK' || got === true) {
      try {
        return await fn();
      } finally {
        await redis.del(lockKey).catch(() => {});
      }
    }

    // 다른 노드가 작업 중 — 짧게 폴링하며 캐시 확인
    const start = Date.now();
    while (Date.now() - start < MAX_WAIT_MS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const cached = await options.fallback?.();
      if (cached !== undefined) return cached;
      const stillLocked = await redis.get(lockKey).catch(() => null);
      if (!stillLocked) break;
    }
    // 시간 초과 — 그냥 우리도 작업 (rare race)
    return fn();
  } catch (e) {
    logger.warn({ err: (e as Error).message, key }, 'distributed lock 실패 — 단일 노드 fallback');
    return fn();
  }
}
