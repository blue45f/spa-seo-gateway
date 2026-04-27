/** Prometheus exposition (text) → 시각화 가능한 카드/히스토그램 데이터로 변환. */

export type Sample = {
  name: string;
  labels: Record<string, string>;
  value: number;
};

export type RenderHistRow = {
  key: string;
  p50?: number;
  p95?: number;
  p99?: number;
  count: number;
};

export type ParsedMetrics = {
  cards: {
    hitRatio: string;
    cacheHits: string;
    cacheMisses: string;
    inflight: number;
  };
  errors: Record<string, number>;
  renderHist: RenderHistRow[];
};

export function parsePrometheus(text: string): Sample[] {
  const lines = text.split('\n').filter((l) => l && !l.startsWith('#'));
  const samples: Sample[] = [];
  for (const l of lines) {
    const m = l.match(/^([a-z_]+)(\{[^}]*\})?\s+([0-9eE+\-.]+)/);
    if (!m) continue;
    const labels: Record<string, string> = {};
    if (m[2]) {
      for (const p of m[2].slice(1, -1).split(',')) {
        const [k, v] = p.split('=');
        if (k && v) labels[k.trim()] = v.replace(/^"|"$/g, '');
      }
    }
    samples.push({ name: m[1], labels, value: Number(m[3]) });
  }
  return samples;
}

export function summarize(samples: Sample[]): ParsedMetrics {
  let hits = 0;
  let misses = 0;
  for (const s of samples) {
    if (s.name === 'gateway_cache_events_total') {
      if (s.labels.event === 'hit') hits += s.value;
      else if (s.labels.event === 'miss') misses += s.value;
    }
  }
  const cards = {
    hitRatio: hits + misses > 0 ? `${((hits / (hits + misses)) * 100).toFixed(1)}%` : '–',
    cacheHits: hits.toFixed(0),
    cacheMisses: misses.toFixed(0),
    inflight: samples.find((s) => s.name === 'gateway_inflight_renders')?.value ?? 0,
  };

  const errors: Record<string, number> = {};
  for (const s of samples) {
    if (s.name === 'gateway_render_errors_total' && s.value > 0) {
      const reason = s.labels.reason ?? 'unknown';
      errors[reason] = (errors[reason] ?? 0) + s.value;
    }
  }

  const buckets: Record<string, { count: number; byLe: Record<number, number> }> = {};
  for (const s of samples) {
    const k = `${s.labels.outcome ?? '?'}/${s.labels.host ?? '?'}`;
    if (s.name === 'gateway_render_duration_ms_bucket') {
      buckets[k] = buckets[k] ?? { count: 0, byLe: {} };
      buckets[k].byLe[Number(s.labels.le)] = s.value;
    } else if (s.name === 'gateway_render_duration_ms_count') {
      buckets[k] = buckets[k] ?? { count: 0, byLe: {} };
      buckets[k].count = s.value;
    }
  }
  const renderHist: RenderHistRow[] = [];
  for (const [k, b] of Object.entries(buckets)) {
    if (!b.count) continue;
    const sorted = Object.entries(b.byLe)
      .map(([le, c]) => [Number(le), c] as const)
      .sort((a, c) => a[0] - c[0]);
    function pct(p: number): number | undefined {
      const target = b.count * p;
      for (const [le, c] of sorted) if (c >= target) return le;
      return sorted.at(-1)?.[0];
    }
    renderHist.push({ key: k, p50: pct(0.5), p95: pct(0.95), p99: pct(0.99), count: b.count });
  }
  renderHist.sort((a, c) => c.count - a.count);

  return { cards, errors, renderHist };
}
