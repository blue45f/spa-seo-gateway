# Examples

`@heejun/spa-seo-gateway-core` 를 다른 환경에 통합하는 패턴 모음.

| 폴더 / 파일 | 설명 |
|--|--|
| [`express/`](express/index.ts) | Express 미들웨어로 봇 분기 |
| [`hono/`](hono/index.ts) | Hono (Node 런타임) 통합 |
| [`nextjs-edge-middleware.ts`](nextjs-edge-middleware.ts) | Next.js Edge `middleware.ts` — 봇만 외부 게이트웨이로 rewrite |

## 공통 패턴

1. **사람은 그대로 통과**, **봇만 게이트웨이/렌더 핸들러로** 분기
2. 캐시 키에는 호스트/언어 등 컨텍스트 포함 (multi-tenant 면 namespace 추가)
3. `browserPool.start()` 는 앱 시작 시 1회, `browserPool.stop()` + `shutdownCache()` 는 SIGTERM 처리

자세한 시나리오는 [`docs/LIBRARY-USAGE.md`](../docs/LIBRARY-USAGE.md) 참고.
