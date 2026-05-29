import { useCallback, useEffect, useState } from 'react';
import { AuthGate } from '../components/AuthGate';
import { EmptyState } from '../components/EmptyState';
import { CardGridSkeleton } from '../components/Skeleton';
import { ApiError, api } from '../lib/api';
import { useStore } from '../lib/store';
import type { SiteInfo } from '../lib/types';

export function Dashboard() {
  return (
    <AuthGate>
      <DashboardBody />
    </AuthGate>
  );
}

function DashboardBody() {
  const t = useStore((s) => s.t);
  const setError = useStore((s) => s.setGlobalError);
  const [info, setInfo] = useState<SiteInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<SiteInfo>('GET', '/admin/api/site');
      setInfo(r);
      setError('');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [setError]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!info) {
    if (loading) {
      return (
        <section className="space-y-4" data-testid="page-dashboard-loading">
          <CardGridSkeleton count={3} />
        </section>
      );
    }
    return (
      <EmptyState
        title={t('dashboard.empty')}
        hint="게이트웨이가 시작되면 mode · routes · cache 와 호스트별 서킷 브레이커 상태가 여기 표시됩니다."
      />
    );
  }

  const ttlMin = Math.floor((info.cache?.ttlMs ?? 0) / 60_000);
  const swrMin = info.cache?.swrMs ? Math.floor(info.cache.swrMs / 60_000) : 0;
  const breakerHosts = info.breakers ? Object.entries(info.breakers) : [];

  return (
    <section className="space-y-5" data-testid="page-dashboard">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-ink">현재 게이트웨이 상태</h2>
        <button
          type="button"
          className="px-3 py-1.5 text-sm rounded-md border border-line bg-panel-2 text-ink-muted hover:text-ink hover:border-line-strong disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={load}
          disabled={loading}
        >
          {t('btn.refresh')}
        </button>
      </div>

      {/* vitals — 동일 카드 3개 그리드가 아닌, 내부 위계가 있는 단일 패널 */}
      <div className="panel divide-y divide-line sm:flex sm:divide-y-0 sm:divide-x">
        <div className="flex-1 p-5 min-w-0">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-ink-subtle">
            <span className="w-1.5 h-1.5 rounded-full bg-ok" aria-hidden="true" />
            mode
          </div>
          <div className="font-mono text-2xl text-ink mt-2">{info.mode}</div>
          <div className="text-xs text-ink-muted mt-1.5 font-mono truncate">
            {info.origin || '(origin 미설정)'}
          </div>
        </div>
        <div className="flex-1 p-5">
          <div className="text-[11px] uppercase tracking-[0.12em] text-ink-subtle">routes</div>
          <div className="font-mono text-2xl text-ink mt-2">{String(info.site?.routes ?? 0)}</div>
          <div className="text-xs text-ink-muted mt-1.5">런타임 활성</div>
        </div>
        <div className="flex-1 p-5">
          <div className="text-[11px] uppercase tracking-[0.12em] text-ink-subtle">cache</div>
          <div className="font-mono text-2xl text-ink mt-2">{ttlMin}m TTL</div>
          <div className="text-xs text-ink-muted mt-2 flex items-center gap-2 flex-wrap">
            <span className="font-mono">{swrMin}m SWR</span>
            <span className={`badge ${info.cache?.redisEnabled ? 'badge--ok' : 'badge--neutral'}`}>
              redis {info.cache?.redisEnabled ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>
      </div>

      <div className="panel p-5">
        <h3 className="font-semibold tracking-tight text-ink mb-3">Circuit breakers (호스트별)</h3>
        {breakerHosts.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-ink-subtle">
              <tr className="border-b border-line">
                <th className="text-left font-medium py-2">host</th>
                <th className="text-left font-medium py-2">state</th>
                <th className="text-right font-medium py-2">failures</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {breakerHosts.map(([host, b]) => (
                <tr key={host}>
                  <td className="py-2.5 font-mono text-xs text-ink">{host}</td>
                  <td className="py-2.5">
                    <span
                      className={`badge ${b.state === 'open' ? 'badge--err' : b.state === 'half-open' ? 'badge--warn' : 'badge--ok'}`}
                    >
                      {b.state}
                    </span>
                  </td>
                  <td className="py-2.5 font-mono text-xs text-right text-ink-muted">
                    {b.failures}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState
            title="아직 추적된 호스트가 없습니다"
            hint="봇 요청이 오리진 호스트로 라우팅되면 실패율 기반 상태(closed · half-open · open)가 집계됩니다."
          />
        )}
      </div>
    </section>
  );
}
