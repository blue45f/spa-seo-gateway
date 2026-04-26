/**
 * OpenTelemetry 트레이싱 — 옵트인. OTEL_EXPORTER_OTLP_ENDPOINT 가 설정되어야 활성.
 *
 * core 가 무거운 OTEL SDK 를 항상 끌고 들어가지 않도록, 메인 SDK 는 peer 의존
 * (선택 설치) 으로 두고 여기서는 @opentelemetry/api 로 작성된 가벼운 헬퍼만
 * 노출. 실제 외부로의 export 는 사용자가 별도 SDK 부트스트랩 파일로 시작.
 */
import { type Attributes, type Span, SpanStatusCode, type Tracer, trace } from '@opentelemetry/api';
import { logger } from './logger.js';

let tracer: Tracer | null = null;

export function getTracer(): Tracer {
  if (!tracer) tracer = trace.getTracer('spa-seo-gateway', '1.2.0');
  return tracer;
}

export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes: Attributes = {},
): Promise<T> {
  const span = getTracer().startSpan(name, { attributes });
  try {
    const result = await fn(span);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (e) {
    const err = e as Error;
    span.recordException(err);
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    throw e;
  } finally {
    span.end();
  }
}

export function tracingEnabled(): boolean {
  return !!process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
}

if (tracingEnabled()) {
  logger.info(
    { endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT },
    'OpenTelemetry 트레이싱 활성 — SDK 부트스트랩이 필요합니다 (docs/OBSERVABILITY.md)',
  );
}
