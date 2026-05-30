import { CircleCheck, CircleX } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AuthGate } from '../components/AuthGate';
import { EmptyState } from '../components/EmptyState';
import { ApiError, api } from '../lib/api';
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
      <div className="alert alert--warn">
        <h3 className="font-semibold mb-1">{t('audit.title')}</h3>
        <p>{t('audit.desc')}</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          className="btn-primary px-3 py-1.5 text-sm font-medium disabled:opacity-60"
          onClick={load}
          disabled={busy}
        >
          {t('audit.refresh')}
        </button>
        <button
          type="button"
          className="btn-ghost px-3 py-1.5 text-sm font-medium disabled:opacity-60"
          onClick={verify}
          disabled={busy}
        >
          {t('audit.verify')}
        </button>
        {verified !== null ? (
          <span
            className={`ml-auto inline-flex items-center gap-1.5 text-sm ${verified ? 'text-ok-fg' : 'text-err-fg'}`}
          >
            {verified ? (
              <CircleCheck className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <CircleX className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            )}
            {verified ? t('audit.ok') : `${t('audit.broken')} brokenAt=${brokenAt}`}
          </span>
        ) : null}
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-panel-2 text-xs uppercase text-ink-muted">
            <tr>
              <th className="px-3 py-2 text-left">timestamp</th>
              <th className="px-3 py-2 text-left">actor</th>
              <th className="px-3 py-2 text-left">action</th>
              <th className="px-3 py-2 text-left">target</th>
              <th className="px-3 py-2 text-left">outcome</th>
              <th className="px-3 py-2 text-left">hash</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {events.map((e, i) => (
              <tr
                // biome-ignore lint/suspicious/noArrayIndexKey: audit log is append-only and never reorders; (ts + i) is stable per row
                key={`${e.ts}-${i}`}
                className="hover:bg-panel-2"
              >
                <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                  {e.ts?.slice(11, 19) ?? '-'}
                </td>
                <td className="px-3 py-2">{e.actor}</td>
                <td className="px-3 py-2 font-mono text-xs">{e.action}</td>
                <td className="px-3 py-2 truncate max-w-xs">{e.target ?? '-'}</td>
                <td className="px-3 py-2">
                  <span className={`badge ${e.outcome === 'ok' ? 'badge--ok' : 'badge--err'}`}>
                    {e.outcome}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-[10px] text-ink-subtle">
                  {e.hash?.slice(0, 12) ?? '-'}
                  {e.hash ? '...' : ''}
                </td>
              </tr>
            ))}
            {events.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    title={t('audit.empty')}
                    hint="설정 변경 · 캐시 무효화 같은 관리자 작업이 발생하면 여기에 기록됩니다."
                  />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
