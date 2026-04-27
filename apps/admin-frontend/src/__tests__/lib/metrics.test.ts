import { describe, expect, it } from 'vitest';
import { parsePrometheus, summarize } from '../../lib/metrics';

const SAMPLE = `# HELP gateway_cache_events_total cache events
# TYPE gateway_cache_events_total counter
gateway_cache_events_total{layer="memory",event="hit"} 80
gateway_cache_events_total{layer="memory",event="miss"} 20
gateway_inflight_renders 3
gateway_render_errors_total{reason="timeout"} 4
gateway_render_errors_total{reason="circuit-open"} 1
gateway_render_duration_ms_bucket{outcome="ok",host="example.com",le="100"} 5
gateway_render_duration_ms_bucket{outcome="ok",host="example.com",le="500"} 18
gateway_render_duration_ms_bucket{outcome="ok",host="example.com",le="2500"} 20
gateway_render_duration_ms_count{outcome="ok",host="example.com"} 20
`;

describe('parsePrometheus', () => {
  it('parses sample lines into samples', () => {
    const samples = parsePrometheus(SAMPLE);
    expect(samples.length).toBeGreaterThan(0);
    const inflight = samples.find((s) => s.name === 'gateway_inflight_renders');
    expect(inflight?.value).toBe(3);
  });

  it('extracts labels', () => {
    const samples = parsePrometheus(SAMPLE);
    const hits = samples.find(
      (s) => s.name === 'gateway_cache_events_total' && s.labels.event === 'hit',
    );
    expect(hits?.value).toBe(80);
  });
});

describe('summarize', () => {
  it('computes hit ratio', () => {
    const r = summarize(parsePrometheus(SAMPLE));
    expect(r.cards.hitRatio).toBe('80.0%');
    expect(r.cards.cacheHits).toBe('80');
    expect(r.cards.cacheMisses).toBe('20');
  });

  it('captures inflight', () => {
    const r = summarize(parsePrometheus(SAMPLE));
    expect(r.cards.inflight).toBe(3);
  });

  it('counts errors by reason', () => {
    const r = summarize(parsePrometheus(SAMPLE));
    expect(r.errors.timeout).toBe(4);
    expect(r.errors['circuit-open']).toBe(1);
  });

  it('builds histogram percentiles', () => {
    const r = summarize(parsePrometheus(SAMPLE));
    const row = r.renderHist.find((h) => h.key === 'ok/example.com');
    expect(row).toBeDefined();
    expect(row?.count).toBe(20);
    // p50 = first le whose cumulative >= 10 → 500
    expect(row?.p50).toBe(500);
    // p95 = first le whose cumulative >= 19 → 2500
    expect(row?.p95).toBe(2500);
  });

  it('returns empty stats for empty input', () => {
    const r = summarize([]);
    expect(r.cards.hitRatio).toBe('–');
    expect(r.renderHist).toHaveLength(0);
  });
});
