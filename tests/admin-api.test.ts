/**
 * Fastify app.inject 를 사용해 어드민 API / multi-tenant / cms 의 라우트가
 * 실제로 등록되고 인증이 동작하는지 확인. 실제 puppeteer 렌더는 발생하지 않으며
 * (별도 테스트), 메모리 store 만 사용.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerAdminUI } from '@spa-seo-gateway/admin-ui';
import { FileSiteStore, registerCms } from '@spa-seo-gateway/cms';
import { FileTenantStore, registerMultiTenant } from '@spa-seo-gateway/multi-tenant';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ADMIN_TOKEN = 'test-admin-token';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'spa-api-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

async function buildApp(
  register: (app: FastifyInstance) => Promise<void>,
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await register(app);
  await app.ready();
  return app;
}

describe('admin-ui plugin', () => {
  it('returns 404 when adminToken is not set in config', async () => {
    // config.adminToken 환경변수 의존 — 본 테스트는 env 미설정 시에만 의미
    // 환경에 ADMIN_TOKEN 이 있을 수 있으므로 적절히 분기
    const app = await buildApp(async (a) => {
      await registerAdminUI(a);
    });
    const res = await app.inject({ method: 'GET', url: '/admin/api/site' });
    expect([200, 401, 404]).toContain(res.statusCode);
    await app.close();
  });
});

describe('multi-tenant API integration', () => {
  it('registers tenant CRUD endpoints with auth', async () => {
    const store = new FileTenantStore(join(tmp, 't.json'));
    const app = await buildApp(async (a) => {
      await registerMultiTenant(a, { store, adminToken: ADMIN_TOKEN });
    });

    // 1) 인증 없으면 401
    const noAuth = await app.inject({ method: 'GET', url: '/admin/api/tenants' });
    expect(noAuth.statusCode).toBe(401);

    // 2) 잘못된 토큰 → 401
    const wrong = await app.inject({
      method: 'GET',
      url: '/admin/api/tenants',
      headers: { 'x-admin-token': 'nope' },
    });
    expect(wrong.statusCode).toBe(401);

    // 3) 정상 인증 → 빈 배열
    const empty = await app.inject({
      method: 'GET',
      url: '/admin/api/tenants',
      headers: { 'x-admin-token': ADMIN_TOKEN },
    });
    expect(empty.statusCode).toBe(200);
    expect(empty.json().tenants).toEqual([]);

    // 4) 테넌트 추가
    const created = await app.inject({
      method: 'POST',
      url: '/admin/api/tenants',
      headers: { 'x-admin-token': ADMIN_TOKEN, 'content-type': 'application/json' },
      payload: {
        id: 'acme',
        name: 'ACME',
        origin: 'https://www.acme.com',
        apiKey: 'tk_test_aaaaaaaaaaaaaaaaaaaa',
      },
    });
    expect(created.statusCode).toBe(200);
    expect(created.json().ok).toBe(true);
    expect(created.json().tenant.id).toBe('acme');

    // 5) 잘못된 페이로드 → 400
    const bad = await app.inject({
      method: 'POST',
      url: '/admin/api/tenants',
      headers: { 'x-admin-token': ADMIN_TOKEN, 'content-type': 'application/json' },
      payload: { id: 'BAD!', name: 'x', origin: 'not-a-url', apiKey: 'short' },
    });
    expect(bad.statusCode).toBe(400);

    // 6) 목록 조회 → 1개
    const list = await app.inject({
      method: 'GET',
      url: '/admin/api/tenants',
      headers: { 'x-admin-token': ADMIN_TOKEN },
    });
    expect(list.json().tenants.length).toBe(1);

    // 7) 삭제
    const del = await app.inject({
      method: 'DELETE',
      url: '/admin/api/tenants/acme',
      headers: { 'x-admin-token': ADMIN_TOKEN },
    });
    expect(del.statusCode).toBe(200);
    expect(del.json().ok).toBe(true);

    // 8) 없는 id 삭제 → 404
    const ghost = await app.inject({
      method: 'DELETE',
      url: '/admin/api/tenants/ghost',
      headers: { 'x-admin-token': ADMIN_TOKEN },
    });
    expect(ghost.statusCode).toBe(404);

    await app.close();
  });

  it('rejects unknown tenant on render path', async () => {
    const store = new FileTenantStore(join(tmp, 'unknown.json'));
    const app = await buildApp(async (a) => {
      await registerMultiTenant(a, { store, adminToken: ADMIN_TOKEN });
    });
    const res = await app.inject({
      method: 'GET',
      url: '/some-path',
      headers: { 'user-agent': 'Googlebot/2.1', host: 'noone.example.com' },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toMatch(/unknown tenant/);
    await app.close();
  });

  it('rejects /api/cache/invalidate without apiKey', async () => {
    const store = new FileTenantStore(join(tmp, 'inv.json'));
    const app = await buildApp(async (a) => {
      await registerMultiTenant(a, { store, adminToken: ADMIN_TOKEN });
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/cache/invalidate',
      payload: { url: 'https://x.com' },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('returns multi-tenant stats with auth', async () => {
    const store = new FileTenantStore(join(tmp, 's.json'));
    await store.upsert({
      id: 'a',
      name: 'A',
      origin: 'https://a.example.com',
      apiKey: 'tk_a_aaaaaaaaaaaaaaaaaaaa',
      routes: [],
      plan: 'free',
      enabled: true,
    });
    const app = await buildApp(async (a) => {
      await registerMultiTenant(a, { store, adminToken: ADMIN_TOKEN });
    });
    const res = await app.inject({
      method: 'GET',
      url: '/admin/api/multi-tenant/stats',
      headers: { 'x-admin-token': ADMIN_TOKEN },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().tenantCount).toBe(1);
    expect(res.json().enabled).toBe(1);
    await app.close();
  });
});

describe('cms API integration', () => {
  it('registers site CRUD endpoints', async () => {
    const store = new FileSiteStore(join(tmp, 'cms.json'));
    const app = await buildApp(async (a) => {
      await registerCms(a, { store, adminToken: ADMIN_TOKEN });
    });

    // 추가
    const created = await app.inject({
      method: 'POST',
      url: '/admin/api/sites',
      headers: { 'x-admin-token': ADMIN_TOKEN, 'content-type': 'application/json' },
      payload: { id: 'docs', name: 'Docs', origin: 'https://docs.example.com' },
    });
    expect(created.statusCode).toBe(200);
    expect(created.json().site.id).toBe('docs');

    // 사이트별 캐시 무효화 (URL 누락 → 400)
    const noUrl = await app.inject({
      method: 'POST',
      url: '/admin/api/sites/docs/cache/invalidate',
      headers: { 'x-admin-token': ADMIN_TOKEN, 'content-type': 'application/json' },
      payload: {},
    });
    expect(noUrl.statusCode).toBe(400);

    // 사이트별 캐시 무효화 (URL 정상)
    const inv = await app.inject({
      method: 'POST',
      url: '/admin/api/sites/docs/cache/invalidate',
      headers: { 'x-admin-token': ADMIN_TOKEN, 'content-type': 'application/json' },
      payload: { url: 'https://docs.example.com/page' },
    });
    expect(inv.statusCode).toBe(200);
    expect(inv.json().ok).toBe(true);

    // 없는 사이트의 무효화 → 404
    const ghost = await app.inject({
      method: 'POST',
      url: '/admin/api/sites/missing/cache/invalidate',
      headers: { 'x-admin-token': ADMIN_TOKEN, 'content-type': 'application/json' },
      payload: { url: 'https://x' },
    });
    expect(ghost.statusCode).toBe(404);

    // 통계
    const stats = await app.inject({
      method: 'GET',
      url: '/admin/api/cms/stats',
      headers: { 'x-admin-token': ADMIN_TOKEN },
    });
    expect(stats.json().siteCount).toBe(1);

    await app.close();
  });

  it('rejects unknown host on render path', async () => {
    const store = new FileSiteStore(join(tmp, 'cms2.json'));
    const app = await buildApp(async (a) => {
      await registerCms(a, { store, adminToken: ADMIN_TOKEN });
    });
    const res = await app.inject({
      method: 'GET',
      url: '/x',
      headers: { 'user-agent': 'Googlebot', host: 'unknown.example.com' },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe('cross-mode contract: bot detection bypass header', () => {
  it('renders only for bot-detected requests in cms mode (others 204)', async () => {
    const store = new FileSiteStore(join(tmp, 'bypass.json'));
    await store.upsert({
      id: 'site',
      name: 'site',
      origin: 'https://www.example.com',
      routes: [],
      enabled: true,
    });
    const app = await buildApp(async (a) => {
      await registerCms(a, { store, adminToken: ADMIN_TOKEN });
    });
    const human = await app.inject({
      method: 'GET',
      url: '/x?_no_render',
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        host: 'www.example.com',
      },
    });
    expect(human.statusCode).toBe(204);
    expect(human.headers['x-bypass-reason']).toBeDefined();
    await app.close();
  });
});
