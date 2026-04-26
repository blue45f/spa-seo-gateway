import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileSiteStore, InMemorySiteStore, type Site } from '@heejun/spa-seo-gateway-cms';
import {
  FileTenantStore,
  InMemoryTenantStore,
  type Tenant,
} from '@heejun/spa-seo-gateway-multi-tenant';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let tmpRoot: string;
beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'spa-seo-store-'));
});
afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

const tenant = (id = 'acme'): Tenant => ({
  id,
  name: id.toUpperCase(),
  origin: `https://${id}.example.com`,
  apiKey: `tk_${id}_${'x'.repeat(20)}`,
  routes: [],
  plan: 'free',
  enabled: true,
});

const site = (id = 'marketing'): Site => ({
  id,
  name: id,
  origin: `https://${id}.example.com`,
  routes: [],
  enabled: true,
});

describe('InMemoryTenantStore', () => {
  it('round-trips upsert/byId/byApiKey/byHost', async () => {
    const store = new InMemoryTenantStore();
    const t = tenant('acme');
    await store.upsert(t);
    expect(await store.byId('acme')).toEqual(t);
    expect(await store.byApiKey(t.apiKey)).toEqual(t);
    expect(await store.byHost('acme.example.com')).toEqual(t);
  });

  it('list returns all upserted', async () => {
    const store = new InMemoryTenantStore();
    await store.upsert(tenant('a'));
    await store.upsert(tenant('b'));
    expect((await store.list()).length).toBe(2);
  });

  it('remove returns false for missing', async () => {
    const store = new InMemoryTenantStore();
    expect(await store.remove('nope')).toBe(false);
  });

  it('remove returns true and clears indexes', async () => {
    const store = new InMemoryTenantStore();
    await store.upsert(tenant('rm'));
    expect(await store.remove('rm')).toBe(true);
    expect(await store.byId('rm')).toBeNull();
    expect(await store.byApiKey(`tk_rm_${'x'.repeat(20)}`)).toBeNull();
  });
});

describe('FileTenantStore', () => {
  it('persists across instances (same file)', async () => {
    const path = join(tmpRoot, 'tenants.json');
    const a = new FileTenantStore(path);
    await a.upsert(tenant('persist'));

    const b = new FileTenantStore(path);
    expect(await b.byId('persist')).toBeTruthy();
  });

  it('list returns empty for missing file', async () => {
    const store = new FileTenantStore(join(tmpRoot, 'nope.json'));
    expect(await store.list()).toEqual([]);
  });

  it('upsert adds createdAt when new', async () => {
    const path = join(tmpRoot, 'tenants.json');
    const store = new FileTenantStore(path);
    await store.upsert(tenant('new'));
    const after = await store.byId('new');
    expect(after?.createdAt).toBeDefined();
  });

  it('upsert preserves createdAt on update', async () => {
    const path = join(tmpRoot, 'tenants.json');
    const store = new FileTenantStore(path);
    const t1 = { ...tenant('keep'), createdAt: 12345 };
    await store.upsert(t1);
    await store.upsert({ ...t1, name: 'updated' });
    const after = await store.byId('keep');
    expect(after?.name).toBe('updated');
    expect(after?.createdAt).toBe(12345);
  });

  it('byHost works with stored origin', async () => {
    const path = join(tmpRoot, 'tenants.json');
    const store = new FileTenantStore(path);
    await store.upsert(tenant('host-test'));
    const found = await store.byHost('host-test.example.com');
    expect(found?.id).toBe('host-test');
  });

  it('drops malformed entries silently on read', async () => {
    const path = join(tmpRoot, 'tenants.json');
    const { writeFileSync } = await import('node:fs');
    writeFileSync(path, JSON.stringify([{ not: 'a tenant' }, tenant('valid')]));
    const store = new FileTenantStore(path);
    const all = await store.list();
    expect(all.length).toBe(1);
    expect(all[0]?.id).toBe('valid');
  });
});

describe('InMemorySiteStore', () => {
  it('round-trips upsert/byId/byHost', async () => {
    const store = new InMemorySiteStore();
    await store.upsert(site('docs'));
    expect((await store.byId('docs'))?.name).toBe('docs');
    expect((await store.byHost('docs.example.com'))?.id).toBe('docs');
  });
});

describe('FileSiteStore', () => {
  it('persists across instances', async () => {
    const path = join(tmpRoot, 'sites.json');
    const a = new FileSiteStore(path);
    await a.upsert(site('marketing'));
    const b = new FileSiteStore(path);
    expect(await b.byId('marketing')).toBeTruthy();
  });

  it('serial upserts produce valid JSON on disk', async () => {
    const path = join(tmpRoot, 'sites.json');
    const store = new FileSiteStore(path);
    await store.upsert(site('a'));
    await store.upsert(site('b'));
    await store.upsert(site('c'));
    const list = await store.list();
    expect(list.length).toBe(3);
    // 디스크에서 직접 읽어도 valid JSON
    const { readFileSync } = await import('node:fs');
    const raw = readFileSync(path, 'utf8');
    expect(() => JSON.parse(raw)).not.toThrow();
    expect(JSON.parse(raw).length).toBe(3);
  });
});
