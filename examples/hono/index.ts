/**
 * Hono + spa-seo-gateway (Node 런타임 전용 — Edge runtime 은 Puppeteer 미지원)
 *
 *   npm i hono @hono/node-server @heejun/spa-seo-gateway-core
 *   tsx index.ts
 */
import {
  browserPool,
  cacheKey,
  cacheSwr,
  detectBot,
  render,
  shutdownCache,
} from '@heejun/spa-seo-gateway-core';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';

const ORIGIN = process.env.ORIGIN_URL ?? 'https://your-spa.example.com';
const app = new Hono();

await browserPool.start();

app.use(async (c, next) => {
  const ua = c.req.header('user-agent');
  const detection = detectBot(
    ua,
    Object.fromEntries(Object.entries(c.req.header())),
    c.req.query(),
  );
  if (!detection.isBot) return next();

  const target = new URL(c.req.path, ORIGIN).toString();
  const result = await cacheSwr(cacheKey(target), () =>
    render({
      url: target,
      headers: Object.fromEntries(
        Object.entries(c.req.header()).map(([k, v]) => [k.toLowerCase(), v]),
      ),
    }),
  );
  for (const [k, v] of Object.entries(result.entry.headers)) c.header(k, v);
  c.header('x-cache', result.fromCache ? 'HIT' : 'MISS');
  return c.html(result.entry.body, result.entry.status as 200);
});

app.get('/health', (c) => c.json({ ok: true }));

serve({ fetch: app.fetch, port: 3000 }, ({ port }) => {
  console.log(`http://localhost:${port}`);
});

const shutdown = async () => {
  await browserPool.stop();
  await shutdownCache();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
