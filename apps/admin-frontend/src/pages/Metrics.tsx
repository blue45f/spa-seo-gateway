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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card
          label="cache hit ratio"
          value={parsed.cards.hitRatio}
          detail={`hit ${parsed.cards.cacheHits} / miss ${parsed.cards.cacheMisses}`}
        />
        <Card label="inflight" value={String(parsed.cards.inflight)} detail="현재 렌더 중" />
        <Card label="cache hits" value={parsed.cards.cacheHits} detail="누적" />
        <Card label="cache misses" value={parsed.cards.cacheMisses} detail="누적" />
      </div>

      {parsed.renderHist.length > 0 ? (
        <div className="panel p-5">
          <h3 className="font-semibold mb-3 text-ink">렌더 지연 히스토그램 (per outcome/host)</h3>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-ink-subtle">
              <tr>
                <th className="text-left py-2">key</th>
                <th className="text-right py-2">p50</th>
                <th className="text-right py-2">p95</th>
                <th className="text-right py-2">p99</th>
                <th className="text-right py-2">count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {parsed.renderHist.map((r) => (
                <tr key={r.key}>
                  <td className="py-2 font-mono text-xs">{r.key}</td>
                  <td className="py-2 text-right font-mono">{r.p50 ?? '-'}</td>
                  <td className="py-2 text-right font-mono">{r.p95 ?? '-'}</td>
                  <td className="py-2 text-right font-mono">{r.p99 ?? '-'}</td>
                  <td className="py-2 text-right font-mono">{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
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

function Card({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="panel p-4">
      <div className="text-xs text-ink-subtle uppercase tracking-wider">{label}</div>
      <div className="font-mono text-2xl mt-1">{value}</div>
      <div className="text-xs text-ink-subtle mt-2">{detail}</div>
    </div>
  );
}
