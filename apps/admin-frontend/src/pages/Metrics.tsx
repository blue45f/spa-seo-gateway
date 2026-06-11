import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthGate } from '../components/AuthGate';
import { Figure } from '../components/Figure';
import { CardGridSkeleton } from '../components/Skeleton';
import { Sparkline } from '../components/Sparkline';
import { errorMessage, fetchText } from '../lib/api';
import { type ParsedMetrics, parsePrometheus, summarize } from '../lib/metrics';
import { useStore } from '../lib/store';

/** 추세선이 의미를 갖도록 최근 폴링 N회의 표본만 보관. */
const TREND_CAP = 24;
const intFmt = (n: number) => String(Math.round(n));
const pctFmt = (n: number) => `${n.toFixed(1)}%`;

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
  // 폴링마다 hit ratio(%) 를 적재해 헤드라인 옆 추세선을 만든다(최근 TREND_CAP 회).
  const [hitTrend, setHitTrend] = useState<number[]>([]);
  const trendRef = useRef<number[]>([]);

  const ctrlRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    // 이전 요청을 취소해, 느린 응답이 더 새 데이터를 덮어쓰는 레이스를 막는다.
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    try {
      const text = await fetchText('/metrics', ctrl.signal);
      if (ctrl.signal.aborted) return;
      setRaw(text);
      const next = summarize(parsePrometheus(text));
      setParsed(next);
      if (next.cards.hitRatioValue != null) {
        trendRef.current = [...trendRef.current, next.cards.hitRatioValue].slice(-TREND_CAP);
        setHitTrend(trendRef.current);
      }
      setUpdated(new Date().toLocaleTimeString());
      setError('');
    } catch (e) {
      if ((e as Error).name === 'AbortError') return; // 교체/언마운트 취소는 무시
      setError(errorMessage(e));
    }
  }, [setError]);

  // 초기 로드 + unmount 시 진행 중 요청 취소
  useEffect(() => {
    void load();
    return () => ctrlRef.current?.abort();
  }, [load]);

  // 5s 자동 갱신 — 숨김 탭에선 스킵, 복귀 시 즉시 갱신
  useEffect(() => {
    if (!autoRefresh) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 5000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
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
          {/* 시각적 계기 표시 — 자동 갱신이 5초마다 시각을 바꾸므로 라이브 영역으로 두지
              않는다(SR 과다 알림 방지). 갱신 박동은 aria-hidden 도트가 운반. */}
          <span className="flex items-center gap-1.5 text-xs text-ink-subtle">
            {autoRefresh ? (
              <span
                key={updated}
                className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-ok"
                title={t('metrics.live')}
                aria-hidden="true"
              />
            ) : null}
            <span className="font-mono">
              {t('metrics.lastUpdated')}: {updated || '...'}
            </span>
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
          <div className="flex items-end justify-between gap-3 mt-2">
            <div className="font-mono text-2xl text-ink leading-none">
              {parsed.cards.hitRatioValue != null ? (
                <Figure value={parsed.cards.hitRatioValue} format={pctFmt} />
              ) : (
                parsed.cards.hitRatio
              )}
            </div>
            {hitTrend.length > 1 ? (
              <span className="text-ink-subtle shrink-0 pb-0.5">
                <span className="sr-only">{t('metrics.hitTrend')}</span>
                <Sparkline values={hitTrend} width={84} height={24} />
              </span>
            ) : null}
          </div>
          <div className="text-xs text-ink-muted mt-1.5 font-mono">
            hit {parsed.cards.cacheHits} / miss {parsed.cards.cacheMisses}
          </div>
        </div>
        <div className="flex-1 p-5">
          <div className="text-[11px] uppercase tracking-[0.12em] text-ink-subtle">inflight</div>
          <div className="font-mono text-2xl text-ink mt-2">
            <Figure value={parsed.cards.inflight} format={intFmt} />
          </div>
          <div className="text-xs text-ink-muted mt-1.5">{t('metrics.inflight.detail')}</div>
        </div>
      </div>

      {parsed.renderHist.length > 0 ? (
        <div className="panel p-5">
          <h3 className="font-semibold mb-3 text-ink">{t('metrics.histogram.title')}</h3>
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
          <h3 className="font-semibold mb-3 text-ink">{t('metrics.errors.title')}</h3>
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
        <summary className="cursor-pointer">{t('metrics.raw.summary')}</summary>
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
          <div
            key={r.key}
            className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs py-1 sm:py-0"
          >
            <span
              className="w-full sm:w-44 shrink-0 truncate font-mono text-ink-muted"
              title={r.key}
            >
              {r.key}
            </span>
            <div className="flex flex-1 items-center gap-2">
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
          </div>
        );
      })}
    </div>
  );
}
