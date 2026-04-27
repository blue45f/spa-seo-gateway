import { useCallback, useEffect, useState } from 'react';
import { AuthGate } from '../components/AuthGate';
import { api, ApiError } from '../lib/api';
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

  if (!info) return <p className="text-sm text-slate-500">{loading ? 'loading...' : t('dashboard.empty')}</p>;

  return (
    <section className="space-y-4" data-testid="page-dashboard">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">현재 게이트웨이 상태</h2>
        <button
          type="button"
          className="px-3 py-1.5 text-sm rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
          onClick={load}
          disabled={loading}
        >
          {t('btn.refresh')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card label="mode" value={info.mode} detail={info.origin || '(origin 미설정)'} />
        <Card
          label="routes"
          value={String(info.site?.routes ?? 0)}
          detail="런타임 활성"
        />
        <Card
          label="cache"
          value={`${Math.floor((info.cache?.ttlMs ?? 0) / 60_000)}m TTL`}
          detail={`${info.cache?.swrMs ? Math.floor(info.cache.swrMs / 60_000) : 0}m SWR · redis ${info.cache?.redisEnabled ? 'ON' : 'OFF'}`}
        />
      </div>

      <div className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200 p-5">
        <h3 className="font-semibold mb-3">Circuit breakers (호스트별)</h3>
        {info.breakers && Object.keys(info.breakers).length > 0 ? (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left py-2">host</th>
                <th className="text-left py-2">state</th>
                <th className="text-left py-2">failures</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {Object.entries(info.breakers).map(([host, b]) => (
                <tr key={host}>
                  <td className="py-2 font-mono text-xs">{host}</td>
                  <td className="py-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${b.state === 'open' ? 'bg-red-100 text-red-800' : b.state === 'half-open' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}
                    >
                      {b.state}
                    </span>
                  </td>
                  <td className="py-2 font-mono text-xs">{b.failures}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-500">아직 추적된 호스트가 없습니다.</p>
        )}
      </div>
    </section>
  );
}

function Card({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200 p-5">
      <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        {label}
      </div>
      <div className="font-mono text-2xl mt-1">{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">{detail}</div>
    </div>
  );
}
