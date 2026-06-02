import { useCallback, useEffect, useState } from 'react';
import { AuthGate } from '../components/AuthGate';
import { RoutesEditor } from '../components/RoutesEditor';
import { ApiError, api } from '../lib/api';
import { useStore } from '../lib/store';
import type { ScopedRoute } from '../lib/types';

export function RoutesPage() {
  return (
    <AuthGate>
      <RoutesBody />
    </AuthGate>
  );
}

function RoutesBody() {
  const t = useStore((s) => s.t);
  const setError = useStore((s) => s.setGlobalError);
  const pushToast = useStore((s) => s.pushToast);
  const [routes, setRoutes] = useState<ScopedRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<{ ok: true; routes: ScopedRoute[] }>('GET', '/admin/api/routes');
      setRoutes(
        (r.routes ?? []).map((x) => ({
          pattern: x.pattern || '',
          ttlMs: x.ttlMs ?? undefined,
          waitUntil: x.waitUntil ?? undefined,
          waitSelector: x.waitSelector ?? undefined,
          waitMs: x.waitMs ?? undefined,
          ignore: x.ignore ?? false,
        })),
      );
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

  const save = useCallback(
    async (persist: boolean) => {
      if (saving) return; // 버튼/⌘S 동시 호출로 인한 중복 PUT 방지
      setSaving(true);
      try {
        const cleaned = routes
          .filter((r) => r.pattern)
          .map((r) => ({
            pattern: r.pattern,
            ...(r.ttlMs ? { ttlMs: Number(r.ttlMs) } : {}),
            ...(r.waitUntil ? { waitUntil: r.waitUntil } : {}),
            ...(r.waitSelector ? { waitSelector: r.waitSelector } : {}),
            ...(r.waitMs ? { waitMs: Number(r.waitMs) } : {}),
            ...(r.ignore ? { ignore: true } : {}),
          }));
        await api('PUT', '/admin/api/routes', { routes: cleaned, persist });
        pushToast(persist ? t('btn.save-disk') : t('btn.save-memory'), 'success');
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : (e as Error).message;
        setError(msg);
        pushToast(msg, 'error');
      } finally {
        setSaving(false);
      }
    },
    [routes, pushToast, setError, t, saving],
  );

  // ⌘/Ctrl + S 단축키
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void save(false);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [save]);

  return (
    <section className="space-y-4" data-testid="page-routes">
      <div className="alert alert--info p-4 text-sm">
        <h3 className="font-semibold text-ink mb-1">{t('routes.title')}</h3>
        <p className="text-ink-muted">{t('routes.intro')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-ghost px-3 py-2 text-sm"
          onClick={load}
          disabled={loading}
        >
          {t('btn.refresh')}
        </button>
        <button
          type="button"
          className="btn-primary ml-auto px-3 py-2 text-sm"
          onClick={() => save(false)}
          disabled={saving}
        >
          {t('btn.save-memory')}
        </button>
        <button
          type="button"
          className="btn-primary px-3 py-2 text-sm"
          onClick={() => save(true)}
          title={t('routes.persist.title')}
          disabled={saving}
        >
          {t('btn.save-disk')}
        </button>
      </div>

      <RoutesEditor routes={routes} onChange={setRoutes} />
    </section>
  );
}
