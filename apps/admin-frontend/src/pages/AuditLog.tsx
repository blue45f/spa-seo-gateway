import { useCallback, useEffect, useState } from 'react';
import { AuthGate } from '../components/AuthGate';
import { api, ApiError } from '../lib/api';
import { useStore } from '../lib/store';
import type { AuditEvent } from '../lib/types';

export function AuditLog() {
  return (
    <AuthGate>
      <AuditLogBody />
    </AuthGate>
  );
}

function AuditLogBody() {
  const t = useStore((s) => s.t);
  const pushToast = useStore((s) => s.pushToast);
  const setError = useStore((s) => s.setGlobalError);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [brokenAt, setBrokenAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await api<{ ok: true; events: AuditEvent[] }>('GET', '/admin/api/audit');
      setEvents(r.events ?? []);
      setError('');
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, [setError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function verify() {
    setBusy(true);
    try {
      const r = await api<{ ok: true; verified: boolean; brokenAt: number | null }>(
        'GET',
        '/admin/api/audit/verify',
      );
      setVerified(r.verified);
      setBrokenAt(r.brokenAt);
      pushToast(
        r.verified ? t('audit.ok') : `${t('audit.broken')} (idx ${r.brokenAt})`,
        r.verified ? 'success' : 'error',
      );
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : (e as Error).message;
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4" data-testid="page-audit">
      <div className="bg-amber-50 dark:bg-amber-950 dark:border-amber-900 border border-amber-200 rounded-lg p-4 text-sm">
        <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-1">{t('audit.title')}</h3>
        <p className="text-amber-800 dark:text-amber-300">{t('audit.desc')}</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          className="px-3 py-1.5 rounded bg-slate-900 dark:bg-indigo-600 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-60"
          onClick={load}
          disabled={busy}
        >
          {t('audit.refresh')}
        </button>
        <button
          type="button"
          className="px-3 py-1.5 rounded bg-white dark:bg-slate-800 text-sm font-medium border border-slate-300 dark:border-slate-700 hover:bg-slate-50 disabled:opacity-60"
          onClick={verify}
          disabled={busy}
        >
          {t('audit.verify')}
        </button>
        {verified !== null ? (
          <span
            className={`ml-auto text-sm ${verified ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
          >
            {verified ? t('audit.ok') : `${t('audit.broken')} brokenAt=${brokenAt}`}
          </span>
        ) : null}
      </div>

      <div className="bg-white dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase text-slate-600 dark:text-slate-300">
            <tr>
              <th className="px-3 py-2 text-left">timestamp</th>
              <th className="px-3 py-2 text-left">actor</th>
              <th className="px-3 py-2 text-left">action</th>
              <th className="px-3 py-2 text-left">target</th>
              <th className="px-3 py-2 text-left">outcome</th>
              <th className="px-3 py-2 text-left">hash</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {events.map((e, i) => (
              <tr
                key={`${e.ts}-${i}`}
                className="hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                  {e.ts?.slice(11, 19) ?? '-'}
                </td>
                <td className="px-3 py-2">{e.actor}</td>
                <td className="px-3 py-2 font-mono text-xs">{e.action}</td>
                <td className="px-3 py-2 truncate max-w-xs">{e.target ?? '-'}</td>
                <td className="px-3 py-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs ${e.outcome === 'ok' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}
                  >
                    {e.outcome}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-[10px] text-slate-400">
                  {e.hash?.slice(0, 12) ?? '-'}
                  {e.hash ? '...' : ''}
                </td>
              </tr>
            ))}
            {events.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-slate-500 dark:text-slate-400"
                >
                  {t('audit.empty')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
