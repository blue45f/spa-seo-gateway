// Vercel Function — demo only. 실제 게이트웨이가 아니라 어드민 UI 의 Welcome 카드를
// 채워주기 위한 mock 응답.
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: true,
    mode: 'demo',
    origin: 'https://demo.example.com',
    multiContext: false,
    cache: { ttlMs: 86_400_000, swrMs: 3_600_000, redisEnabled: false },
    site: { origin: 'https://demo.example.com', mode: 'demo', routes: 0 },
    nodeVersion: 'v24.x',
    uptimeSec: Math.floor(Date.now() / 1000) % 86400,
    timestamp: new Date().toISOString(),
    _demo: true,
    _note:
      '이것은 정적 데모입니다. 실제 운영은 https://github.com/blue45f/spa-seo-gateway 의 Cloud Run / Fly.io / Docker 호스트에 배포하세요.',
  });
}
