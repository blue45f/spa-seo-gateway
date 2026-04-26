# Migration: v1.5 → v1.7

**Breaking changes: 없음**. v1.5 의 모든 코드는 v1.7 에서 그대로 동작합니다. 본 문서는 새로 추가된 기능을 활성화하는 방법만 설명합니다.

## 패키지 업데이트

```sh
pnpm up @heejun/spa-seo-gateway-core@^1.7.0 \
  @heejun/spa-seo-gateway-admin-ui@^1.7.0 \
  @heejun/spa-seo-gateway-multi-tenant@^1.7.0 \
  @heejun/spa-seo-gateway-cms@^1.7.0
```

CLI:

```sh
pnpm up -g @heejun/spa-seo-gateway-cli@^1.2.0
```

## 새 기능 켜기

### 1) A/B variants

`seo-gateway.config.json` 의 routes 배열에 `variants` 필드 추가. 기존 `pattern`/`ttlMs`/`waitUntil` 등은 그대로.

```json
{
  "routes": [
    {
      "pattern": "^/products/",
      "ttlMs": 3600000,
      "variants": [
        { "title": "구매 30% 할인", "weight": 1 },
        { "title": "지금 구매하면 무료배송", "weight": 2 }
      ]
    }
  ]
}
```

응답 헤더 `x-prerender-variant` 와 Prometheus `gateway_variant_impressions_total` 로 인상 추적.

### 2) Visual regression (CI 통합)

`runVisualDiff()` 를 CI 에 추가:

```ts
import { runVisualDiff } from '@heejun/spa-seo-gateway-core';

const r = await runVisualDiff('https://staging.example.com/');
if (r.diffPercent > 1) process.exit(1);
```

baseline 은 `.data/baselines/` 에 누적. PR 머지 후 `mode: 'create'` 로 baseline 갱신.

### 3) AI schema 어댑터 (Anthropic)

```sh
pnpm add @heejun/spa-seo-gateway-anthropic @anthropic-ai/sdk
```

```ts
import { setAiSchemaAdapter } from '@heejun/spa-seo-gateway-core';
import { createAnthropicSchemaAdapter } from '@heejun/spa-seo-gateway-anthropic';

setAiSchemaAdapter(
  createAnthropicSchemaAdapter({ apiKey: process.env.ANTHROPIC_API_KEY }),
);
```

OpenAI/Gemini 등 다른 LLM 은 `AiSchemaAdapter` 인터페이스만 맞춰 직접 구현. resume 프로젝트의 `LlmService.generateWithFallback` 패턴 참고 가능.

### 4) Audit chain HMAC 서명

환경변수만 추가하면 활성:

```sh
AUDIT_WEBHOOK_SECRET=your-secret-256bit
# 또는
HMAC_SECRET=your-secret-256bit
```

기존 `recordAudit()` 호출은 그대로 — 자동으로 서명 필드가 추가됩니다. `verifyAuditChain()` 으로 변조 여부 즉시 검증.

### 5) Helm chart values

새 항목 (모두 선택):

```yaml
audit:
  hmacSecret:
    existingSecret: gateway-secrets
    existingSecretKey: audit-hmac

ai:
  anthropic:
    apiKey:
      existingSecret: gateway-secrets
      existingSecretKey: anthropic-api-key
```

## 동작이 다를 수 있는 경우

### `setAiSchemaAdapter(null)` 호출 시그니처

v1.5 에서는 `null` 이 타입 에러였지만, v1.7 에서는 `null` 허용 — 어댑터를 명시적으로 해제할 수 있습니다 (테스트/언마운트 용). 기존 코드는 영향 없음.

### `x-prerender-variant` 응답 헤더

variants 가 정의된 라우트에서만 추가됩니다. 기존 라우트(variants 없음) 의 응답에는 영향 없음.

## CLI doctor 신규 점검

`ssg doctor` 실행 시:

```
✓ Node.js v24.2.0
✓ pnpm 9.14.4
✓ Chromium / Chrome  (자동 다운로드됨 — puppeteer 가 처리)
✓ Port 3000  사용 가능
✓ ADMIN_TOKEN  설정됨
⚠ Audit HMAC  (없음 — 감사 로그는 hash chain 만)
⚠ Anthropic API key  (없음 — AI schema 추론 비활성)
```

⚠ 는 단순 안내 — 동작은 정상.

## 다음 메이저 업그레이드 계획

v2.0 은 **외부 시스템 통합** 에 초점:

- Stripe billing 어댑터 실제 구현 패키지
- Google Search Console 어댑터 실제 구현 패키지
- 새로운 dashboard 의 "Tenant Usage" 페이지

v2.0 에서도 v1.7 코드는 그대로 동작 — 신규 패키지를 추가 설치만 하면 됩니다.
