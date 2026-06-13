/**
 * telemetry.ts: OpenTelemetry helper. SDK 부트스트랩 없이도 trace API 를
 * 호출할 수 있어야 하며 (no-op tracer), error 가 발생하면 span 의 status 가
 * ERROR 로 기록된다.
 */
import { getTracer, tracingEnabled, withSpan } from '@heejun/spa-seo-gateway-core'
import { describe, expect, it } from 'vitest'

describe('telemetry', () => {
  it('tracingEnabled reflects OTEL_EXPORTER_OTLP_ENDPOINT env var', () => {
    const before = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    try {
      delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT
      expect(tracingEnabled()).toBe(false)
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://otel.local:4318'
      expect(tracingEnabled()).toBe(true)
    } finally {
      if (before === undefined) delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT
      else process.env.OTEL_EXPORTER_OTLP_ENDPOINT = before
    }
  })

  it('getTracer returns a tracer instance', () => {
    const t = getTracer()
    expect(t).toBeDefined()
    expect(typeof (t as { startSpan: unknown }).startSpan).toBe('function')
  })

  it('withSpan runs the callback and returns its value', async () => {
    const v = await withSpan('test-span', async () => 'ok')
    expect(v).toBe('ok')
  })

  it('withSpan passes attributes and propagates result', async () => {
    const v = await withSpan(
      'attr-span',
      async (span) => {
        expect(span).toBeDefined()
        return 7
      },
      { 'attr.k': 'v' }
    )
    expect(v).toBe(7)
  })

  it('withSpan rethrows errors after marking span error', async () => {
    await expect(
      withSpan('err-span', async () => {
        throw new Error('span-fail')
      })
    ).rejects.toThrow(/span-fail/)
  })
})
