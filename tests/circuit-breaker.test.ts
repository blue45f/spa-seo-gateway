import { breakerStats, isCircuitOpen, withBreaker } from '@spa-seo-gateway/core';
import { describe, expect, it } from 'vitest';

const uniq = (label: string) => `cb-${label}-${Math.random().toString(36).slice(2)}`;

describe('circuit breaker', () => {
  it('passes through successful calls', async () => {
    const host = uniq('ok');
    const fn = withBreaker(host, async (x: number) => x * 2);
    expect(await fn(5)).toBe(10);
    expect(isCircuitOpen(host)).toBe(false);
  });

  it('reuses the same breaker per host', async () => {
    const host = uniq('reuse');
    const fn1 = withBreaker(host, async (x: number) => x);
    const fn2 = withBreaker(host, async (x: number) => x);
    await fn1(1);
    await fn2(2);
    const stats = breakerStats();
    expect(stats[host]).toBeDefined();
  });

  it('does not affect other hosts on failure', async () => {
    const failingHost = uniq('fail');
    const okHost = uniq('ok2');
    const failing = withBreaker(failingHost, async () => {
      throw new Error('boom');
    });
    const okFn = withBreaker(okHost, async () => 'ok');

    for (let i = 0; i < 3; i++) {
      await failing().catch(() => {});
    }
    expect(await okFn()).toBe('ok');
    expect(isCircuitOpen(okHost)).toBe(false);
  });

  it('breakerStats exposes per-host state', async () => {
    const host = uniq('stats');
    const fn = withBreaker(host, async () => 1);
    await fn();
    const stats = breakerStats();
    expect(stats[host]).toMatchObject({ opened: false });
  });
});
