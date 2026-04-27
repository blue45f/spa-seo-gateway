import { useCallback, useEffect, useState } from 'react';
import { AuthGate } from '../components/AuthGate';
import { RoutesEditor } from '../components/RoutesEditor';
import { api, ApiError } from '../lib/api';
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
      }
    },
    [routes, pushToast, setError, t],
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
      <div className="bg-blue-50 dark:bg-indigo-950 dark:border-indigo-900 border border-blue-200 rounded-lg p-4 text-sm">
        <h3 className="font-semibold text-blue-900 dark:text-indigo-200 mb-1">
          {t('routes.title')}
        </h3>
        <p className="text-blue-800 dark:text-indigo-300">{t('routes.intro')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="px-3 py-2 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm"
          onClick={load}
          disabled={loading}
        >
          {t('btn.refresh')}
        </button>
        <button
          type="button"
          className="ml-auto px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
          onClick={() => save(false)}
        >
          {t('btn.save-memory')}
        </button>
        <button
          type="button"
          className="px-3 py-2 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-sm"
          onClick={() => save(true)}
          title="seo-gateway.config.json 에 영구 저장"
        >
          {t('btn.save-disk')}
        </button>
      </div>

      <RoutesEditor routes={routes} onChange={setRoutes} />
    </section>
  );
}
