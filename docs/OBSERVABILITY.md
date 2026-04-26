# Observability

Prometheus 메트릭은 항상 켜져 있고, OpenTelemetry 트레이싱은 옵트인입니다.

## 1. Prometheus (기본 활성)

```bash
curl http://localhost:3000/metrics
```

### 핵심 메트릭

| 메트릭 | 라벨 | 설명 |
|--|--|--|
| `gateway_render_duration_ms` | `outcome,host` | 렌더 지연 히스토그램 |
| `gateway_cache_events_total` | `layer,event` | hit/miss/swr/dedup |
| `gateway_render_errors_total` | `reason` | timeout/network/crashed/ssrf/circuit-open |
| `gateway_browser_pool` | `state` | total/active/idle |
| `gateway_inflight_renders` | – | 현재 진행 중 |
| `gateway_http_requests_total` | `route,status,kind` | 요청 분류 |

### 알람 레시피

```yaml
- alert: SeoGatewayHighRenderLatency
  expr: histogram_quantile(0.95, rate(gateway_render_duration_ms_bucket[5m])) > 5000
- alert: SeoGatewayCacheHitDrop
  expr: |
    sum(rate(gateway_cache_events_total{event="hit"}[5m])) /
    sum(rate(gateway_cache_events_total{event=~"hit|miss"}[5m]))
    < 0.7
- alert: SeoGatewayPoolExhausted
  expr: increase(gateway_render_errors_total{reason="pool-exhausted"}[5m]) > 0
```

## 2. OpenTelemetry 트레이싱 (옵트인)

`render()` 와 `cacheSwr()` 가 자동으로 span 을 만듭니다. 수출(export) 만 사용자가 부트스트랩.

### 활성화

```bash
# 환경변수
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=spa-seo-gateway
```

### SDK 부트스트랩 파일 (`telemetry-bootstrap.ts`)

```ts
// telemetry-bootstrap.ts — apps/gateway 의 main.ts 보다 먼저 import
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'spa-seo-gateway',
  }),
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [getNodeAutoInstrumentations()],
});
sdk.start();
process.on('SIGTERM', () => sdk.shutdown());
```

설치:
```bash
pnpm add @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-http @opentelemetry/resources @opentelemetry/semantic-conventions
```

실행:
```bash
node --import ./telemetry-bootstrap.js dist/main.js
```

### 자동 만들어지는 span

| span | attributes |
|--|--|
| `render` | `http.url`, `gateway.route` |
| HTTP 요청 (Fastify auto-instrumentation) | 표준 `http.*` |
| Outgoing fetch (puppeteer, redis 등) | 자동 |

### 시각화 — Jaeger / Tempo / Honeycomb

`OTEL_EXPORTER_OTLP_ENDPOINT` 만 바꿔서 어디든 보낼 수 있음:
- Jaeger: `http://jaeger:4318`
- Grafana Tempo: `http://tempo:4318`
- Honeycomb: `https://api.honeycomb.io/v1/traces` + `OTEL_EXPORTER_OTLP_HEADERS=x-honeycomb-team=...`
- Datadog: 별도 agent 사용 권장

## 3. 구조화 로그 (pino)

stdout 으로 JSON Lines. 파이프해서 Loki / CloudWatch / Datadog Logs 로:

```bash
pnpm start | pino-loki -h http://loki:3100
```

`LOG_LEVEL=debug` 로 자세히, `LOG_PRETTY=true` 로 dev 컬러.

## 4. Audit 로그

`/admin/api/audit` 엔드포인트 + 옵션:
- `AUDIT_LOG_FILE=/var/log/seo-gateway/audit.log` 로 영구화
- `AUDIT_WEBHOOK_URL=https://webhook.example.com` 로 외부 시스템 통보
