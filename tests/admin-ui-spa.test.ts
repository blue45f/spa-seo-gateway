/**
 * 빌드된 admin SPA 가 Fastify 플러그인을 통해 올바르게 서빙되는지 확인.
 * - apps/admin-frontend 의 Vite 산출물이 packages/admin-ui/public/ 에 있어야 한다 (root build 가 보장).
 * - 정적 자산, SPA fallback, public/admin endpoint 가 동시에 동작해야 한다.
 *
 * 본 테스트는 빌드가 완료된 상태에서 실행됨을 전제로 한다 (CI/husky 가 build 를 먼저 돌림).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerAdminUI } from '@heejun/spa-seo-gateway-admin-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const adminPublic = resolve(repoRoot, 'packages/admin-ui/public');

let app: FastifyInstance;

beforeEach(async () => {
  app = Fastify({ logger: false });
  await registerAdminUI(app);
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe('admin-ui SPA hosting', () => {
  it('publishes the Vite build output to packages/admin-ui/public', () => {
    expect(existsSync(adminPublic)).toBe(true);
    expect(existsSync(resolve(adminPublic, 'index.html'))).toBe(true);
    const assetsDir = resolve(adminPublic, 'assets');
    expect(existsSync(assetsDir)).toBe(true);
    // hashed 자산이 적어도 한 개 (js + css) 존재.
    const files = readdirSync(assetsDir);
    expect(files.some((f) => f.endsWith('.js'))).toBe(true);
    expect(files.some((f) => f.endsWith('.css'))).toBe(true);
  });

  it('built index.html references the React root + asset paths under /admin/ui/', () => {
    const html = readFileSync(resolve(adminPublic, 'index.html'), 'utf8');
    expect(html).toContain('<div id="root"></div>');
    // base 가 /admin/ui/ 로 설정되어 모든 자산이 그 prefix 로 발급됨.
    expect(html).toMatch(/src="\/admin\/ui\/assets\/[^"]+\.js"/);
    expect(html).toMatch(/href="\/admin\/ui\/assets\/[^"]+\.css"/);
    // FOUC 방지 dark-mode bootstrap 스크립트 포함.
    expect(html).toContain('seo-admin-theme');
  });

  it('GET /admin/ui redirects to /admin/ui/', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/ui' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/admin/ui/');
  });

  it('GET /admin/ui/ serves index.html (200, html content-type)', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/ui/' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.body).toContain('<div id="root"></div>');
    expect(res.body).toMatch(/\/admin\/ui\/assets\/[^"]+\.js/);
  });

  it('GET /admin/ui/<deep-link> falls back to index.html (SPA routing)', async () => {
    // react-router 가 클라이언트에서 해석 — 서버는 index.html 만 반환.
    for (const path of [
      '/admin/ui/dashboard',
      '/admin/ui/visual',
      '/admin/ui/audit',
      '/admin/ui/some/nested/path',
    ]) {
      const res = await app.inject({ method: 'GET', url: path });
      expect(res.statusCode, `path=${path}`).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.body).toContain('<div id="root"></div>');
    }
  });

  it('GET /admin/ui/assets/<hashed.js> serves the built bundle (200, javascript)', async () => {
    const assetsDir = resolve(adminPublic, 'assets');
    const jsFile = readdirSync(assetsDir).find((f) => f.endsWith('.js'));
    expect(jsFile).toBeDefined();
    const res = await app.inject({ method: 'GET', url: `/admin/ui/assets/${jsFile}` });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/javascript/);
    expect(res.body.length).toBeGreaterThan(100);
  });

  it('GET /admin/ui/assets/<hashed.css> serves the built stylesheet', async () => {
    const assetsDir = resolve(adminPublic, 'assets');
    const cssFile = readdirSync(assetsDir).find((f) => f.endsWith('.css'));
    expect(cssFile).toBeDefined();
    const res = await app.inject({ method: 'GET', url: `/admin/ui/assets/${cssFile}` });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/css/);
  });

  it('GET /admin/ui/assets/missing-file.js returns 404 (real asset miss)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/ui/assets/definitely-not-a-real-hashed.js',
    });
    expect(res.statusCode).toBe(404);
  });

  it('GET /admin/api/public/info returns mode + cache info without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/api/public/info' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.mode).toBe('string');
    expect(typeof body.uptimeSec).toBe('number');
    expect(typeof body.nodeVersion).toBe('string');
  });

  it('GET /admin/api/whoami reports unauthenticated by default', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/api/whoami' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.authenticated).toBe(false);
  });

  it('protected endpoints require auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/api/site' });
    expect([401, 404]).toContain(res.statusCode); // 404 if adminToken not set, 401 if set but missing
  });
});
