/**
 * Next.js (Vercel) + 외부 호스팅된 spa-seo-gateway
 *
 * 이 파일을 프로젝트 루트에 `middleware.ts` 로 둡니다. Edge runtime 에서 동작 —
 * 봇 트래픽만 외부 게이트웨이로 rewrite. 사람은 Next.js 가 그대로 SSR/SPA 처리.
 *
 * 환경 변수:
 *   SEO_GATEWAY_HOST=spa-seo-gateway.your-cluster.internal   # Cloud Run / Fly.io 호스트
 */
import { type NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: ['/((?!_next|api|favicon.ico|robots.txt|sitemap.xml).*)'],
};

const BOT_RE =
  /(?:googlebot|bingbot|yeti|naverbot|baiduspider|duckduckbot|yandexbot|facebookexternalhit|twitterbot|slackbot|linkedinbot|telegrambot|whatsapp|kakaotalk-scrap|discordbot|applebot)/i;

export function middleware(req: NextRequest) {
  const ua = req.headers.get('user-agent') ?? '';
  if (!BOT_RE.test(ua)) return NextResponse.next();

  const gw = process.env.SEO_GATEWAY_HOST;
  if (!gw) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.hostname = gw;
  return NextResponse.rewrite(url, {
    headers: { 'x-spa-seo-bot': '1' },
  });
}
