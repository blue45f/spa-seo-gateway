import { useCallback, useEffect, useState } from 'react';
import { AuthGate } from '../components/AuthGate';
import { CardGridSkeleton } from '../components/Skeleton';
import { fetchText } from '../lib/api';
import { type ParsedMetrics, parsePrometheus, summarize } from '../lib/metrics';
import { useStore } from '../lib/store';

export function Metrics() {
  return (
    <AuthGate>
      <MetricsBody />
    </AuthGate>
  );
}

function MetricsBody() {
  const t = useStore((s) => s.t);
  const setError = useStore((s) => s.setGlobalError);
  const [parsed, setParsed] = useState<ParsedMetrics | null>(null);
  const [raw, setRaw] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [updated, setUpdated] = useState('');

  const load = useCallback(async () => {
    try {
      const text = await fetchText('/metrics');
      setRaw(text);
      setParsed(summarize(parsePrometheus(text)));
      setUpdated(new Date().toLocaleTimeString());
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [setError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const id = setInterval(() => void load(), 5000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  if (!parsed) return <CardGridSkeleton count={3} />;

  return (
    <section className="space-y-4" data-testid="page-metrics">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-ink">{t('metrics.title')}</h2>
        <div className="flex items-center gap-2 text-sm">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              className="checkbox h-4 w-4"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            {t('metrics.autoRefresh')}
          </label>
          <span className="text-xs text-ink-subtle">
            {t('metrics.lastUpdated')}: {updated || '...'}
          </span>
          <button type="button" className="btn-ghost px-3 py-1.5" onClick={load}>
            {t('btn.refresh')}
          </button>
        </div>
      </div>

      {/* 동일 4-카드 그리드가 아닌, hit ratio 를 헤드라인으로 둔 내부 위계 단일 패널 */}
      <div className="panel divide-y divide-line sm:flex sm:divide-y-0 sm:divide-x">
        <div className="flex-1 p-5 min-w-0">
          <div className="text-[11px] uppercase tracking-[0.12em] text-ink-subtle">
            cache hit ratio
          </div>
          <div className="font-mono text-2xl text-ink mt-2">{parsed.cards.hitRatio}</div>
          <div className="text-xs text-ink-muted mt-1.5 font-mono">
            hit {parsed.cards.cacheHits} / miss {parsed.cards.cacheMisses}
          </div>
        </div>
        <div className="flex-1 p-5">
          <div className="text-[11px] uppercase tracking-[0.12em] text-ink-subtle">inflight</div>
          <div className="font-mono text-2xl text-ink mt-2">{String(parsed.cards.inflight)}</div>
          <div className="text-xs text-ink-muted mt-1.5">현재 렌더 중</div>
        </div>
      </div>

      {parsed.renderHist.length > 0 ? (
        <div className="panel p-5">
          <h3 className="font-semibold mb-3 text-ink">렌더 지연 히스토그램 (per outcome/host)</h3>
          <LatencyBars rows={parsed.renderHist} />
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead className="bg-panel-2 text-xs uppercase text-ink-muted">
                <tr>
                  <th className="text-left px-3 py-2">key</th>
                  <th className="text-right px-3 py-2">p50</th>
                  <th className="text-right px-3 py-2">p95</th>
                  <th className="text-right px-3 py-2">p99</th>
                  <th className="text-right px-3 py-2">count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {parsed.renderHist.map((r) => (
                  <tr key={r.key}>
                    <td className="px-3 py-2 font-mono text-xs">{r.key}</td>
                    <td className="px-3 py-2 text-right font-mono">{pp(r.p50)}</td>
                    <td className="px-3 py-2 text-right font-mono">{pp(r.p95)}</td>
                    <td className="px-3 py-2 text-right font-mono">{pp(r.p99)}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {Object.keys(parsed.errors).length > 0 ? (
        <div className="panel p-5">
          <h3 className="font-semibold mb-3 text-ink">에러 분류</h3>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-line">
              {Object.entries(parsed.errors)
                .sort((a, b) => b[1] - a[1])
                .map(([reason, count]) => (
                  <tr key={reason}>
                    <td className="py-2 font-mono text-xs">{reason}</td>
                    <td className="py-2 text-right font-mono">{count}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <details className="text-sm">
        <summary className="cursor-pointer">/metrics 원본 (Prometheus exposition)</summary>
        <pre className="panel-inset mt-2 text-xs p-3 overflow-auto max-h-96">
          {raw || '(empty)'}
        </pre>
      </details>
    </section>
  );
}

/** p95 latency → status tone: green <1s, amber <3s, red ≥3s. */
function latencyTone(ms: number): 'ok' | 'warn' | 'err' {
  if (ms < 1000) return 'ok';
  if (ms < 3000) return 'warn';
  return 'err';
}

/** Percentile print: '-' when missing, '>30s' for the +Inf / NaN bucket, else the ms value. */
function pp(v?: number): string {
  if (v == null) return '-';
  return Number.isFinite(v) ? String(v) : '>30s';
}

const TONE_BAR: Record<'ok' | 'warn' | 'err', string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  err: 'bg-err',
};

/**
 * Horizontal p95-latency bars per histogram key — at-a-glance render health.
 * Decorative (aria-hidden): the table below carries the same data for SR users.
 */
function LatencyBars({ rows }: { rows: { key: string; p95?: number }[] }) {
  const withP95 = rows.filter((r): r is { key: string; p95: number } => r.p95 != null);
  if (withP95.length === 0) return null;
  // Scale only against finite p95s — a +Inf / NaN bucket must not poison Math.max.
  const max = Math.max(...withP95.map((r) => r.p95).filter(Number.isFinite), 1);
  return (
    <div className="mb-4 space-y-1.5" aria-hidden="true">
      {withP95.map((r) => {
        const finite = Number.isFinite(r.p95);
        const tone = finite ? latencyTone(r.p95) : 'err';
        const width = finite ? Math.max(2, Math.min(100, (r.p95 / max) * 100)) : 100;
        return (
          <div key={r.key} className="flex items-center gap-2 text-xs">
            <span className="w-44 shrink-0 truncate font-mono text-ink-muted" title={r.key}>
              {r.key}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-panel-2">
              <div
                className={`h-full rounded-full ${TONE_BAR[tone]}`}
                style={{ width: `${width}%` }}
              />
            </div>
            <span className="w-16 shrink-0 text-right font-mono text-ink">
              {finite ? `${r.p95}ms` : '>30s'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
