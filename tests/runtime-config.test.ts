import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  getRoutes,
  matchRoute,
  persistRoutesToFile,
  setRoutes,
} from '@heejun/spa-seo-gateway-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let tmp: string;
let originalCwd: string;
let originalEnv: string | undefined;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'spa-rt-'));
  originalCwd = process.cwd();
  originalEnv = process.env.GATEWAY_CONFIG_FILE;
  process.chdir(tmp);
  // runtime-config 가 module-load 시점에 잡은 PERSIST_FILE 은 변경 불가하므로
  // tmp 디렉토리에서 작업이 진행되도록 cwd 만 옮긴다.
  setRoutes([]);
});

afterEach(() => {
  process.chdir(originalCwd);
  process.env.GATEWAY_CONFIG_FILE = originalEnv;
  rmSync(tmp, { recursive: true, force: true });
});

describe('runtime-config routes', () => {
  it('setRoutes / getRoutes round-trip', () => {
    setRoutes([{ pattern: '^/blog/', ttlMs: 1000 }]);
    const r = getRoutes();
    expect(r.length).toBe(1);
    expect(r[0]?.pattern).toBe('^/blog/');
    expect(r[0]?.ttlMs).toBe(1000);
  });

  it('matchRoute returns first match', () => {
    setRoutes([
      { pattern: '^/products/[0-9]+', ttlMs: 100 },
      { pattern: '^/products/', ttlMs: 200 },
    ]);
    const m = matchRoute('https://www.example.com/products/123');
    expect(m?.ttlMs).toBe(100);
  });

  it('matchRoute returns null on no match', () => {
    setRoutes([{ pattern: '^/api/', ignore: true }]);
    expect(matchRoute('https://www.example.com/blog/x')).toBeNull();
  });

  it('matchRoute handles invalid URL gracefully', () => {
    setRoutes([{ pattern: '.*' }]);
    expect(matchRoute('not a url at all')).toBeNull();
  });

  it('setRoutes recompiles regex on each call', () => {
    setRoutes([{ pattern: '^/v1/' }]);
    expect(matchRoute('https://e.com/v1/x')).toBeTruthy();
    setRoutes([{ pattern: '^/v2/' }]);
    expect(matchRoute('https://e.com/v1/x')).toBeNull();
    expect(matchRoute('https://e.com/v2/x')).toBeTruthy();
  });

  it('persistRoutesToFile writes JSON to specified path', async () => {
    setRoutes([{ pattern: '^/persist-test/', ttlMs: 60_000 }]);
    const target = join(tmp, 'config.json');
    const result = await persistRoutesToFile(target);
    expect(result.ok).toBe(true);
    expect(result.path).toBe(target);
    const written = JSON.parse(readFileSync(target, 'utf8'));
    expect(written.routes).toEqual([{ pattern: '^/persist-test/', ttlMs: 60_000 }]);
  });

  it('persistRoutesToFile preserves existing JSON keys', async () => {
    const target = join(tmp, 'existing.json');
    const { writeFileSync } = await import('node:fs');
    writeFileSync(target, JSON.stringify({ originUrl: 'https://x.com', other: 1 }));
    setRoutes([{ pattern: '^/y/' }]);
    await persistRoutesToFile(target);
    const written = JSON.parse(readFileSync(target, 'utf8'));
    expect(written.originUrl).toBe('https://x.com');
    expect(written.other).toBe(1);
    expect(written.routes).toEqual([{ pattern: '^/y/' }]);
  });
});
