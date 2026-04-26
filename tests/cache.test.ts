import {
  type CacheEntry,
  cacheClear,
  cacheDel,
  cacheGet,
  cacheKey,
  cacheSet,
  cacheStats,
  cacheSwr,
} from '@spa-seo-gateway/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const tag = (s: string) => `test:${s}:${Math.random().toString(36).slice(2)}`;

const entry = (overrides: Partial<CacheEntry> = {}): CacheEntry => ({
  body: '<html><body>hi</body></html>',
  status: 200,
  headers: { 'content-type': 'text/html' },
  createdAt: Date.now(),
  ...overrides,
});

beforeEach(async () => {
  await cacheClear();
});
afterEach(async () => {
  await cacheClear();
});

describe('cache (memory layer)', () => {
  it('round-trips small body without compression', async () => {
    const k = tag('small');
    await cacheSet(k, entry());
    const got = await cacheGet(k);
    expect(got?.body).toBe('<html><body>hi</body></html>');
    expect(got?.status).toBe(200);
  });

  it('round-trips large body with brotli compression', async () => {
    const k = tag('large');
    const big = `${'<html><body>'.padEnd(50_000, 'x')}</body></html>`;
    await cacheSet(k, entry({ body: big }));
    const got = await cacheGet(k);
    expect(got?.body).toBe(big);
  });

  it('preserves headers and status', async () => {
    const k = tag('headers');
    await cacheSet(k, entry({ status: 404, headers: { 'x-test': 'value' } }));
    const got = await cacheGet(k);
    expect(got?.status).toBe(404);
    expect(got?.headers['x-test']).toBe('value');
  });

  it('cacheDel removes entries', async () => {
    const k = tag('del');
    await cacheSet(k, entry());
    await cacheDel(k);
    expect(await cacheGet(k)).toBeUndefined();
  });

  it('cacheStats returns config snapshot', () => {
    const s = cacheStats();
    expect(typeof s.ttlMs).toBe('number');
    expect(typeof s.swrMs).toBe('number');
    expect(typeof s.redisEnabled).toBe('boolean');
  });
});

describe('cacheKey', () => {
  it('namespace produces different key for same URL', () => {
    const a = cacheKey('https://example.com/', 'en', 'tenant:a');
    const b = cacheKey('https://example.com/', 'en', 'tenant:b');
    expect(a).not.toBe(b);
  });

  it('omitted namespace is stable', () => {
    const a = cacheKey('https://example.com/');
    const b = cacheKey('https://example.com/');
    expect(a).toBe(b);
  });
});

describe('cacheSwr', () => {
  it('returns fresh entry when within TTL', async () => {
    const k = tag('swr-fresh');
    let calls = 0;
    const fetcher = async () => {
      calls++;
      return entry();
    };
    const r1 = await cacheSwr(k, fetcher);
    expect(r1.fromCache).toBeNull();
    expect(calls).toBe(1);

    const r2 = await cacheSwr(k, fetcher);
    expect(r2.fromCache).toBe('cache');
    expect(r2.stale).toBe(false);
    expect(calls).toBe(1);
  });

  it('dedups concurrent fetchers (only one runs)', async () => {
    const k = tag('dedup');
    let calls = 0;
    const slow = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 30));
      return entry();
    };
    await Promise.all([cacheSwr(k, slow), cacheSwr(k, slow), cacheSwr(k, slow), cacheSwr(k, slow)]);
    expect(calls).toBe(1);
  });

  it('returns stale + revalidates when past TTL but within SWR window', async () => {
    const k = tag('stale');
    // 24h TTL 기본 + 1h SWR. 24.5h 전 createdAt 이면 stale 윈도우 내.
    const stale = entry({ createdAt: Date.now() - (24 * 60 + 30) * 60 * 1000 });
    await cacheSet(k, stale);

    let revalidations = 0;
    const fetcher = async () => {
      revalidations++;
      return entry();
    };
    const r = await cacheSwr(k, fetcher);
    expect(r.stale).toBe(true);
    expect(r.fromCache).toBe('cache');
    // 백그라운드 revalidate 가 시작되었는지
    await new Promise((res) => setTimeout(res, 30));
    expect(revalidations).toBe(1);
  });

  it('respects entry.ttlOverrideMs over global TTL', async () => {
    const k = tag('override');
    const shortLived = entry({ ttlOverrideMs: 50 });
    let calls = 0;
    const fetcher = async () => {
      calls++;
      return shortLived;
    };

    await cacheSwr(k, fetcher);
    expect(calls).toBe(1);

    // override TTL 만큼 기다린 후엔 stale 로 판정 → 백그라운드 재호출 발생
    await new Promise((r) => setTimeout(r, 80));
    await cacheSwr(k, fetcher);
    await new Promise((r) => setTimeout(r, 30));
    expect(calls).toBeGreaterThan(1);
  });
});
