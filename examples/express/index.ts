/**
 * Express + spa-seo-gateway 통합 예시
 *
 *   npm i express @heejun/spa-seo-gateway-core
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
import express from 'express';

const ORIGIN = process.env.ORIGIN_URL ?? 'https://your-spa.example.com';
const app = express();

await browserPool.start();

app.use(async (req, res, next) => {
  const ua = req.headers['user-agent'];
  const detection = detectBot(ua, req.headers, req.query as Record<string, unknown>);
  if (!detection.isBot) return next(); // 사람은 다음 미들웨어/라우트로

  const target = new URL(req.url, ORIGIN).toString();
  try {
    const result = await cacheSwr(cacheKey(target), () =>
      render({ url: target, headers: req.headers as Record<string, string> }),
    );
    res.status(result.entry.status);
    for (const [k, v] of Object.entries(result.entry.headers)) res.setHeader(k, v);
    res.setHeader('x-cache', result.fromCache ? 'HIT' : 'MISS');
    res.send(result.entry.body);
  } catch (e) {
    res.status(502).send({ error: 'render failed', message: (e as Error).message });
  }
});

// 사람 트래픽은 여기서 SPA 정적 파일 또는 origin 으로 프록시
app.get('/health', (_req, res) => res.json({ ok: true }));

const server = app.listen(3000, () => {
  console.log('http://localhost:3000');
});

const shutdown = async () => {
  server.close();
  await browserPool.stop();
  await shutdownCache();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
