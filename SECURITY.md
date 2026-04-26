# Security Policy

## 지원 버전

| 버전 | 보안 패치 |
|--|--|
| 1.x | ✅ |
| 0.x | ❌ |

## 보안 이슈 신고

**공개 이슈 트래커에 보고하지 마세요.** 다음 중 하나로:

- 이메일: blue45f@gmail.com (제목: `[SECURITY] spa-seo-gateway: ...`)
- GitHub Security Advisory: https://github.com/blue45f/spa-seo-gateway/security/advisories/new

48시간 안에 1차 응답, 7일 안에 패치 또는 ETA 회신 목표.

## 보안 모델

### 위협 모델

| 위협 | 방어 |
|--|--|
| **SSRF** — 임의 내부 URL 렌더 시도 | DNS resolve 후 사설 IP/loopback 차단 (`isSafeTarget`) + `ALLOWED_HOSTS` 화이트리스트 |
| **Cross-tenant 캐시 노출** (saas/cms) | `cacheKey` namespace prefix (`tenant:<id>` / `site:<id>`) |
| **Admin API 무단 접근** | `ADMIN_TOKEN` 헤더 인증 (미설정 시 admin disabled) |
| **DDoS / 폭주** | `@fastify/rate-limit` per-IP + circuit breaker per-host |
| **메모리/자원 고갈** | Pool slot semaphore + 자동 브라우저 재시작 + page timeout |
| **Cookie/state 누출** | 매 요청마다 새 BrowserContext (incognito) |

### 알려진 한계

- `--no-sandbox` 로 chromium 실행 (컨테이너 격리에 의존). 호스트 직접 실행은 비권장
- Admin token 평문 저장 (env / config 파일). 운영 환경은 K8s Secret / AWS SSM / Vault 등 사용
- File-based store (multi-tenant/cms) 는 동시 쓰기 시 마지막 쓰기 승. 분산 환경은 외부 DB 어댑터 권장
- 의존성 (puppeteer, fastify 등) 의 보안 이슈는 자동 alert 으로만 추적

### 책임 공개

- 신고 → 검증 → 패치 → CVE 발급 (필요 시) → 공개 가이드라인 준수
- 합리적인 시간(보통 90일) 안에 책임 있는 공개를 약속하는 신고자에게 감사
